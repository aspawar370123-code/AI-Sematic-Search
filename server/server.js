require("dotenv").config();
const multer = require("multer");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const https = require("https");
const axios = require("axios");
const { Pinecone } = require("@pinecone-database/pinecone");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { VoyageAIClient } = require("voyageai");

// Internal Modules
const QueryHistory = require("./models/QueryHistory");
const Document = require("./models/Document");
const Admin = require("./models/Admin");
const Officer = require("./models/Officer");
const { processDocument, queryDocuments } = require("./config/embeddings");
const upload = require("./config/multerCloudinary");
const cloudinary = require("./config/cloudinary");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

app.use(cors({
  origin: true, // reflects the request origin — allows any origin including localhost and deployed frontend
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
  credentials: true
}));
app.options("/{*path}", cors()); // handle preflight for all routes
app.use(express.json());

/* MongoDB Connection */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Atlas Connected"))
  .catch(err => console.error("MongoDB Error:", err));

/* ─── Shared Helpers ─────────────────────────────────────────── */

const getPineconeIndex = () => {
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  return pc.index(process.env.PINECONE_INDEX);
};

const getEmbedding = async (text) => {
  const result = await voyage.embed({ input: [text], model: "voyage-3-lite" });
  return result.data[0].embedding;
};

/* ─── Routes ─────────────────────────────────────────────────── */

app.get("/", (req, res) => res.send("Server running"));

/* Admin Routes */
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (!admin || admin.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });
    res.json({ message: "Login successful" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/admin/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (await Admin.findOne({ email }))
      return res.status(400).json({ message: "Admin already exists" });
    await new Admin({ email, password }).save();
    res.json({ message: "Admin account created successfully" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* Officer Routes */
app.post("/officer/register", async (req, res) => {
  const { name, designation, email, password } = req.body;
  try {
    if (await Officer.findOne({ email }))
      return res.status(400).json({ message: "Officer already registered" });
    await new Officer({ name, designation, email, password }).save();
    res.json({ message: "Registration request submitted" });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/officer/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const officer = await Officer.findOne({ email });
    if (!officer || officer.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });
    await Officer.findByIdAndUpdate(officer._id, { lastActiveAt: new Date() });
    res.json({ message: "Login successful", officer: { name: officer.name, designation: officer.designation } });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* Upload Route — saves doc, starts embedding in background, responds immediately */
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const { title, authority, docType, year } = req.body;
  if (!title || !authority || !docType || !year)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const yearValue = req.body.year === "N/A" ? "N/A" : parseInt(req.body.year);
    const newDoc = new Document({
      title: title.trim(),
      authority: authority.trim(),
      docType: docType.trim(),
      year: yearValue,
      fileUrl: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      cloudinaryId: req.file.filename,
      embeddingStatus: "processing",
    });
    await newDoc.save();
    console.log("=== DOCUMENT SAVED | ID:", newDoc._id.toString(), "===");

    // Respond immediately with the doc ID — frontend will poll for status
    res.json({
      message: "Document saved. Embeddings processing...",
      document: { id: newDoc._id, title: newDoc.title, fileUrl: newDoc.fileUrl, embeddingStatus: "processing" },
    });

    // Run embedding pipeline in background AFTER response is sent
    try {
      console.log("=== EMBEDDING PIPELINE STARTING ===");
      await processDocument(newDoc);
      await Document.findByIdAndUpdate(newDoc._id, { embeddingStatus: "done" });
      console.log("=== EMBEDDING PIPELINE COMPLETE ===");
    } catch (embErr) {
      await Document.findByIdAndUpdate(newDoc._id, { embeddingStatus: "failed" });
      console.error("=== EMBEDDING FAILED ===", embErr.message, embErr.stack);
    }

  } catch (error) {
    console.error("=== UPLOAD ERROR ===", error.message);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

/* Status polling endpoint */
app.get("/documents/:id/status", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).select("embeddingStatus title");
    if (!doc) return res.status(404).json({ message: "Document not found" });
    // Old docs uploaded before embeddingStatus field existed — treat as done
    const status = doc.embeddingStatus || "done";
    res.json({ embeddingStatus: status, title: doc.title });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch status", error: error.message });
  }
});

/* Documents CRUD */
app.get("/documents", async (req, res) => {
  try {
    res.json(await Document.find().sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

app.patch("/documents/:id/rename", async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    doc.title = title.trim();
    await doc.save();
    const index = getPineconeIndex();
    const listed = await index.listPaginated({ prefix: `${req.params.id}-chunk-` });
    const ids = (listed.vectors || []).map(v => v.id);
    await Promise.all(ids.map(id => index.update({ id, metadata: { title: title.trim() } })));
    res.json({ message: "Document renamed successfully", title: doc.title });
  } catch (error) {
    res.status(500).json({ message: "Rename failed", error: error.message });
  }
});

app.delete("/documents/:id", async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // 1. Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryId);
    } catch (err) {
      console.error("Cloudinary delete failed, trying raw...", err.message);
      await cloudinary.uploader.destroy(doc.cloudinaryId, { resource_type: "raw" });
    }

    // 2. Delete from Pinecone
    try {
      const index = getPineconeIndex();
      const listResponse = await index.listPaginated({ prefix: `${req.params.id}-` });
      const vectorIds = (listResponse.vectors || []).map(v => v.id);
      if (vectorIds.length > 0) {
        console.log(`Deleting ${vectorIds.length} vectors for doc: ${req.params.id}`);
        await index.deleteMany(vectorIds);
      } else {
        console.log("No vectors found in Pinecone for this ID prefix.");
      }
    } catch (vectorErr) {
      console.error("Pinecone cleanup failed:", vectorErr.message);
    }

    // 3. Delete from MongoDB
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete route error:", error);
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});

/* Stats */
app.get("/stats", async (req, res) => {
  try {
    const [total, policies, regulations, schemes, reports, totalQueries, activeUsers] = await Promise.all([
      Document.countDocuments(),
      Document.countDocuments({ docType: "Policy" }),
      Document.countDocuments({ docType: "Regulation" }),
      Document.countDocuments({ docType: "Scheme" }),
      Document.countDocuments({ docType: "Report" }),
      QueryHistory.countDocuments(),
      Officer.countDocuments(),
    ]);
    res.json({ total, policies, regulations, schemes, reports, totalQueries, activeUsers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

/* AI Query (legacy) */
app.post("/query", async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) return res.status(400).json({ message: "Question is required" });
  try {
    res.json(await queryDocuments(question));
  } catch (error) {
    res.status(500).json({ message: "Query failed", error: error.message });
  }
});

const generateSparseVector = (text) => {
  const words = text.toLowerCase().match(/\w+/g) || [];
  const counts = {};
  words.forEach(word => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % 1000000;
    counts[index] = (counts[index] || 0) + 1;
  });
  return {
    indices: Object.keys(counts).map(Number),
    values: Object.values(counts).map(v => parseFloat(v.toFixed(2)))
  };
};

/* Corrected Search Route - Add to server.js */
app.post("/api/officer/search", async (req, res) => {
  const { queryText } = req.body;
  if (!queryText?.trim()) return res.status(400).json({ message: "Query text is required" });

  try {
    const vector = await getEmbedding(queryText); // Returns 512 dims for voyage-3-lite
    const sparseVector = generateSparseVector(queryText); 

    const index = getPineconeIndex();

    const queryResponse = await index.query({
      vector,
      sparseVector,
      topK: 12,
      includeMetadata: true
    });

    const bestChunkPerDoc = new Map();
    for (const m of queryResponse.matches) {
      const docId = m.metadata?.docId;
      if (!docId) continue;
      if (!bestChunkPerDoc.has(docId) || m.score > bestChunkPerDoc.get(docId).score)
        bestChunkPerDoc.set(docId, m);
    }

    const uniqueDocIds = Array.from(bestChunkPerDoc.keys());
    const docs = await Document.find({ _id: { $in: uniqueDocIds } }).select("_id fileUrl fileName");
    const docMap = Object.fromEntries(docs.map(d => [d._id.toString(), d]));

    const enriched = uniqueDocIds.map(docId => {
  const m = bestChunkPerDoc.get(docId);
  const dbDoc = docMap[docId];
  if (!dbDoc) return null;

  const rawExcerpt = m.metadata.text || "";
  const nonAsciiRatio = (rawExcerpt.match(/[^\x00-\x7F]/g) || []).length / (rawExcerpt.length || 1);
  const words = rawExcerpt.split(/\s+/).filter(w => w.length > 2);
  const realWordRatio = words.filter(w => /^[a-zA-Z]{3,}$/.test(w)).length / (words.length || 1);
  
  const excerpt = (nonAsciiRatio > 0.3 || realWordRatio < 0.25)
    ? "[Content in multiple languages. View full document for details.]"
    : rawExcerpt;

    const rawScore = m.score;
  const normalizedScore = Math.min(Math.max(rawScore / 25.0, 0), 1);

      return {
        _id: docId,
        score: normalizedScore,
        title: m.metadata.title,
        authority: m.metadata.authority,
        year: m.metadata.year,
        docType: m.metadata.docType,
        excerpt,
        fileUrl: dbDoc.fileUrl || null,
        fileName: dbDoc.fileName || null,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    await new QueryHistory({
      queryText,
      topDocumentTitle: enriched[0]?.title || "N/A",
      results: enriched,
    }).save();

    res.json({ documents: enriched });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});

/* Officer Ask (RAG) */
app.post("/api/officer/ask", async (req, res) => {
  const { queryText, authority, year, docType } = req.body;
  if (!queryText?.trim()) return res.status(400).json({ message: "queryText is required" });

  try {
    const vector = await getEmbedding(queryText);
    const index = getPineconeIndex();

    const filter = {};
    if (authority && authority !== "") filter.authority = { $eq: authority };
    if (year && year !== "") filter.year = { $eq: String(year) };
    if (docType && docType !== "") filter.docType = { $eq: docType };

    const queryResponse = await index.query({
      vector,
      topK: 6,
      includeMetadata: true,
      ...(Object.keys(filter).length > 0 && { filter }),
    });

    const matches = queryResponse.matches || [];
    if (!matches.length) {
      return res.json({
        answer: "No relevant policy documents were found. Please try rephrasing or adjusting your filters.",
        sources: [],
      });
    }

    const contextChunks = matches
      .filter(m => m.metadata?.text)
      .map((m, i) => `[Source ${i + 1}] ${m.metadata.title} (${m.metadata.authority}, ${m.metadata.year}):\n${m.metadata.text}`)
      .join("\n\n---\n\n");

    const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert assistant for the Department of Higher Education.
The policy documents below may be written in English, Hindi, or Marathi.
Read and understand all languages, then answer ONLY in clear English.
Be specific, cite which source your answer comes from, and keep the answer concise.
If the answer is not found in the documents, say so clearly.

OFFICER'S QUESTION: ${queryText}

POLICY DOCUMENT EXCERPTS:
${contextChunks}

ANSWER (in English):`;

    const genResult = await generativeModel.generateContent(prompt);
    const answer = genResult.response.text();

    const bestChunkPerDoc = new Map();
    for (const m of matches) {
      const docId = m.metadata?.docId;
      if (!docId) continue;
      if (!bestChunkPerDoc.has(docId) || m.score > bestChunkPerDoc.get(docId).score)
        bestChunkPerDoc.set(docId, m);
    }

    const uniqueDocIds = Array.from(bestChunkPerDoc.keys());
    const dbDocs = await Document.find({ _id: { $in: uniqueDocIds } }).lean();
    const dbDocMap = Object.fromEntries(dbDocs.map(d => [d._id.toString(), d]));

    const sources = uniqueDocIds.map(docId => {
      const chunk = bestChunkPerDoc.get(docId);
      const dbDoc = dbDocMap[docId];
      if (!dbDoc) return null;
      return {
        _id: docId,
        title: dbDoc.title,
        authority: dbDoc.authority,
        docType: dbDoc.docType,
        year: dbDoc.year,
        fileUrl: dbDoc.fileUrl,
        fileName: dbDoc.fileName,
        score: chunk.score,
        excerpt: chunk.metadata?.text || "",
        chunkIndex: chunk.metadata?.chunkIndex,
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    res.json({ answer, sources });
  } catch (error) {
    console.error("Ask error:", error);
    res.status(500).json({ message: "Failed to retrieve policy info", error: error.message });
  }
});

/* Officer Summarize */
app.post("/api/officer/summarize", async (req, res) => {
  const { docId, excerptText } = req.body;
  if (!docId) return res.status(400).json({ message: "docId is required" });

  try {
    let chunkTexts = "";

    if (excerptText && excerptText.trim().length > 20 && !excerptText.startsWith("[")) {
      chunkTexts = excerptText;
      console.log("Summarize: using excerpt from frontend");
    } else {
      const index = getPineconeIndex();
      let vectorIds = [];
      let nextToken = undefined;
      do {
        const listed = await index.listPaginated({
          prefix: `${docId}-chunk-`,
          ...(nextToken && { paginationToken: nextToken }),
        });
        vectorIds.push(...(listed.vectors || []).map(v => v.id));
        nextToken = listed.pagination?.next;
      } while (nextToken);

      console.log(`Summarize: found ${vectorIds.length} vectors for docId ${docId}`);

      if (!vectorIds.length)
        return res.json({ summary: "No content found for this document in the knowledge base." });

      const allRecords = {};
      for (let i = 0; i < vectorIds.length; i += 100) {
        const batch = vectorIds.slice(i, i + 100);
        const fetched = await index.fetch({ ids: batch });
        Object.assign(allRecords, fetched.records ?? {});
      }

      console.log(`Summarize: fetched ${Object.keys(allRecords).length} records`);

      if (!Object.keys(allRecords).length)
        return res.json({ summary: "Could not retrieve document content." });

      chunkTexts = Object.values(allRecords)
        .sort((a, b) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0))
        .map(r => r.metadata?.text || "")
        .filter(t => t.trim().length > 0)
        .slice(0, 10)
        .join("\n\n");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert policy analyst for the Department of Higher Education.
The document content below may be in English, Hindi, or Marathi (or a mix).
Read and fully understand the content regardless of language.
Produce a clear, well-structured summary ONLY in English covering:
- A 2-3 sentence overview of what this document is about
- Key points as bullet points
- Any important figures, deadlines, or eligibility criteria mentioned

DOCUMENT CONTENT:
${chunkTexts}

SUMMARY (in English):`;

    const result = await model.generateContent(prompt);
    res.json({ summary: result.response.text() });
  } catch (error) {
    console.error("Summarize error:", error.message, error.stack);
    res.status(500).json({ message: "Summarization failed", error: error.message });
  }
});

/* Officer Query History */
app.get("/api/officer/history", async (req, res) => {
  try {
    const history = await QueryHistory.find().sort({ createdAt: -1 }).limit(20);
    res.json(history);
  } catch (err) {
    res.status(500).send(err);
  }
});

/* Test Models Route */
app.get("/test-models", (req, res) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  https.get(url, (response) => {
    let data = "";
    response.on("data", chunk => data += chunk);
    response.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        const embeddingModels = parsed.models
          .filter(m => m.supportedGenerationMethods?.includes("embedContent"))
          .map(m => m.name);
        res.json({ embeddingModels });
      } catch {
        res.status(500).json({ error: "Failed to parse models response" });
      }
    });
  }).on("error", err => res.status(500).json({ error: err.message }));
});

/* Error Middleware */
app.use((err, req, res, next) => {
  console.error("Middleware error:", err);
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ message: "File too large (max 10MB)" });
  if (err.message === "Only PDF files are allowed")
    return res.status(400).json({ message: err.message });
  res.status(500).json({ message: "Internal server error", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));