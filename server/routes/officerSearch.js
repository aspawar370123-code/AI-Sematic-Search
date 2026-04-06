// officerSearch.route.js
// Place this in your routes/ or controllers/ folder and mount it in your Express app:
//   app.use('/api/officer', require('./routes/officerSearch.route'));
//
// Required env variables:
//   GEMINI_API_KEY        - Your Google Gemini API key
//   PINECONE_API_KEY      - Your Pinecone API key
//   PINECONE_INDEX_NAME   - Your Pinecone index name (e.g. "policy-index")
//   MONGODB_URI           - Your MongoDB connection string (if not already connected)

const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pinecone } = require("@pinecone-database/pinecone");
const mongoose = require("mongoose");

// ─── Mongoose Model (adjust to match your existing Document model) ────────────
// If you already have a Document model, import it instead of redefining here.
let Document;
try {
  Document = mongoose.model("Document");
} catch {
  const documentSchema = new mongoose.Schema({
    title: String,
    authority: String,
    docType: String,
    year: Number,
    fileUrl: String,       // Cloudinary raw URL
    fileName: String,
    fileSize: Number,
    cloudinaryId: String,
  });
  Document = mongoose.model("Document", documentSchema);
}

// ─── Clients ─────────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Helper: embed a query string using Gemini text-embedding-004
async function embedQuery(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await model.embedContent(text);
  return result.embedding.values; // float[]
}

// ─── POST /api/officer/search ─────────────────────────────────────────────────
// Body: { queryText: string, authority?: string, year?: string, docType?: string, topK?: number }
// Returns: { documents: [...] }
router.post("/search", async (req, res) => {
  try {
    const {
      queryText,
      authority,
      year,
      docType,
      topK = 8,
    } = req.body;

    if (!queryText || !queryText.trim()) {
      return res.status(400).json({ error: "queryText is required" });
    }

    // 1. Embed the officer's query
    const queryVector = await embedQuery(queryText.trim());

    // 2. Build optional Pinecone metadata filter
    const filter = {};
    if (authority && authority !== "All" && authority !== "") {
      filter.authority = { $eq: authority };
    }
    if (year && year !== "All" && year !== "") {
      filter.year = { $eq: String(year) };
    }
    if (docType && docType !== "All" && docType !== "") {
      filter.docType = { $eq: docType };
    }

    // 3. Query Pinecone
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const queryOptions = {
      vector: queryVector,
      topK,
      includeMetadata: true,
      includeValues: false,
    };
    if (Object.keys(filter).length > 0) {
      queryOptions.filter = filter;
    }

    const pineconeResponse = await index.query(queryOptions);
    const matches = pineconeResponse.matches || [];

    if (matches.length === 0) {
      return res.json({ documents: [] });
    }

    // 4. Deduplicate by docId — keep the best-scoring chunk per document
    const bestChunkPerDoc = new Map();
    for (const match of matches) {
      const docId = match.metadata?.docId;
      if (!docId) continue;
      if (!bestChunkPerDoc.has(docId) || match.score > bestChunkPerDoc.get(docId).score) {
        bestChunkPerDoc.set(docId, match);
      }
    }

    // 5. Fetch MongoDB metadata for each unique docId
    const uniqueDocIds = Array.from(bestChunkPerDoc.keys());
    const objectIds = uniqueDocIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const dbDocs = await Document.find({ _id: { $in: objectIds } }).lean();
    const dbDocMap = new Map(dbDocs.map((d) => [d._id.toString(), d]));

    // 6. Merge Pinecone chunk data with MongoDB metadata
    const results = uniqueDocIds
      .map((docId) => {
        const chunk = bestChunkPerDoc.get(docId);
        const dbDoc = dbDocMap.get(docId);
        if (!dbDoc) return null;

        return {
          _id: docId,
          title: dbDoc.title || chunk.metadata?.title || "Untitled",
          authority: dbDoc.authority || chunk.metadata?.authority || "Unknown",
          docType: dbDoc.docType || chunk.metadata?.docType || "Document",
          year: dbDoc.year || chunk.metadata?.year || "N/A",
          fileUrl: dbDoc.fileUrl || null,      // Direct Cloudinary URL for viewing
          fileName: dbDoc.fileName || `${dbDoc.title}.pdf`,
          score: chunk.score,                  // Relevance score (0–1)
          excerpt: chunk.metadata?.text || "", // The matched chunk text
          chunkIndex: chunk.metadata?.chunkIndex,
        };
      })
      .filter(Boolean)
      // Sort by score descending
      .sort((a, b) => b.score - a.score);

    return res.json({ documents: results });
  } catch (err) {
    console.error("[Officer Search Error]", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// ─── GET /api/officer/document/:id ───────────────────────────────────────────
// Returns the Cloudinary fileUrl for direct viewing/downloading
router.get("/document/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Document not found" });
    return res.json({ fileUrl: doc.fileUrl, fileName: doc.fileName });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;