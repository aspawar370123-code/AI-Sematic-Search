// officerAsk.route.js  (add to your existing officerSearch.route.js or mount separately)
// Mount in Express: app.use('/api/officer', require('./routes/officerAsk.route'));
//
// This route handles the "Ask Policy Question" feature:
//   POST /api/officer/ask  →  { answer: string, sources: [...] }
//
// Flow: Query → Gemini embed → Pinecone search → fetch MongoDB metadata
//       → Build context prompt → Gemini generateContent → return answer + sources

const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { VoyageAIClient } = require("voyageai");
const { Pinecone } = require("@pinecone-database/pinecone");
const mongoose = require("mongoose");

let Document;
try {
  Document = mongoose.model("Document");
} catch {
  const documentSchema = new mongoose.Schema({
    title: String, authority: String, docType: String, year: Number,
    fileUrl: String, fileName: String, fileSize: Number, cloudinaryId: String,
  });
  Document = mongoose.model("Document", documentSchema);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function embedQuery(text) {
  const result = await voyage.embed({ input: [text], model: "voyage-3-lite" });
  return result.data[0].embedding;
}

// ─── POST /api/officer/ask ────────────────────────────────────────────────────
router.post("/ask", async (req, res) => {
  try {
    const { queryText, authority, year, docType, topK = 6 } = req.body;

    if (!queryText?.trim()) {
      return res.status(400).json({ error: "queryText is required" });
    }

    // 1. Embed the question
    const queryVector = await embedQuery(queryText.trim());

    // 2. Build metadata filter for Pinecone
    const filter = {};
    if (authority && authority !== "All" && authority !== "") filter.authority = { $eq: authority };
    if (year && year !== "All" && year !== "") filter.year = { $eq: String(year) };
    if (docType && docType !== "All" && docType !== "") filter.docType = { $eq: docType };

    // 3. Query Pinecone for top-K chunks
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);
    const queryOptions = { vector: queryVector, topK, includeMetadata: true, includeValues: false };
    if (Object.keys(filter).length > 0) queryOptions.filter = filter;

    const { matches = [] } = await index.query(queryOptions);

    if (matches.length === 0) {
      return res.json({
        answer: "No relevant policy documents were found for your query. Please try rephrasing or adjusting your filters.",
        sources: [],
      });
    }

    // 4. Build context from top chunks
    const contextChunks = matches
      .filter((m) => m.metadata?.text)
      .map((m, i) => {
        const meta = m.metadata;
        return `[Source ${i + 1}] ${meta.title || "Unknown"} (${meta.authority || ""}, ${meta.year || ""}):\n${meta.text}`;
      })
      .join("\n\n---\n\n");

    // 5. Generate answer using Gemini Flash
    const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert assistant for the Department of Higher Education. 
Answer the officer's question using ONLY the policy document excerpts provided below.
Be specific, cite which source your answer comes from, and keep the answer concise and clear.
If the answer is not found in the documents, say so clearly.

OFFICER'S QUESTION: ${queryText}

POLICY DOCUMENT EXCERPTS:
${contextChunks}

ANSWER (be precise, mention source titles where relevant):`;

    const result = await generativeModel.generateContent(prompt);
    const answer = result.response.text();

    // 6. Get MongoDB metadata for unique docs (best chunk per doc)
    const bestChunkPerDoc = new Map();
    for (const m of matches) {
      const docId = m.metadata?.docId;
      if (!docId) continue;
      if (!bestChunkPerDoc.has(docId) || m.score > bestChunkPerDoc.get(docId).score) {
        bestChunkPerDoc.set(docId, m);
      }
    }

    const uniqueDocIds = Array.from(bestChunkPerDoc.keys());
    const objectIds = uniqueDocIds.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
    const dbDocs = await Document.find({ _id: { $in: objectIds } }).lean();
    const dbDocMap = new Map(dbDocs.map((d) => [d._id.toString(), d]));

    const sources = uniqueDocIds
      .map((docId) => {
        const chunk = bestChunkPerDoc.get(docId);
        const dbDoc = dbDocMap.get(docId);
        if (!dbDoc) return null;
        return {
          _id: docId,
          title: dbDoc.title || chunk.metadata?.title,
          authority: dbDoc.authority || chunk.metadata?.authority,
          docType: dbDoc.docType || chunk.metadata?.docType,
          year: dbDoc.year || chunk.metadata?.year,
          fileUrl: dbDoc.fileUrl || null,
          fileName: dbDoc.fileName,
          score: chunk.score,
          excerpt: chunk.metadata?.text || "",
          chunkIndex: chunk.metadata?.chunkIndex,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return res.json({ answer, sources });

  } catch (err) {
    console.error("[Officer Ask Error]", err);
    return res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

module.exports = router;
