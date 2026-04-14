import dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import https from "https";
import { Pinecone } from "@pinecone-database/pinecone";
import { createRequire } from "module";
import natural from "natural";

const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai");

// Internal Modules
import QueryHistory from "./models/QueryHistory.js";
import Document from "./models/Document.js";
import Admin from "./models/Admin.js";
import Officer from "./models/Officer.js";
import { processDocument, queryDocuments } from "./config/embeddings.js";
import upload from "./config/multerCloudinary.js";
import cloudinary from "./config/cloudinary.js";

const app = express();
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const getPineconeIndex = () => {
  return pc.index(process.env.PINECONE_INDEX);
};
const getEmbedding = async (text) => {
  const result = await voyage.embed({ input: [text], model: "voyage-3-lite" });
  return result.data[0].embedding;
};

/* ─── Routes ─────────────────────────────────────────────────── */

app.get("/", (req, res) => res.send("Server running"));

// Test endpoint to check Pinecone
app.get("/test-pinecone", async (req, res) => {
  try {
    const index = getPineconeIndex();
    const stats = await index.describeIndexStats();
    res.json({
      success: true,
      stats: stats,
      message: "Pinecone connected successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Pinecone connection failed"
    });
  }
});

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

const tokenizer = new natural.WordTokenizer();

const generateSparseVector = (text) => {
  const tokens = tokenizer.tokenize(text.toLowerCase()) || [];

  const counts = {};

  tokens.forEach(token => {
    if (token.length < 3) return; // remove noise
    counts[token] = (counts[token] || 0) + 1;
  });

  const vocabulary = Object.keys(counts);

  return {
    indices: vocabulary.map((_, i) => i),
    values: vocabulary.map(word => Math.log(1 + counts[word]))
  };
};

app.post("/api/officer/search", async (req, res) => {
  const { queryText } = req.body;

  if (!queryText?.trim()) {
    return res.status(400).json({ message: "Query text is required" });
  }

  console.log("\n" + "=".repeat(60));
  console.log("NEW SEARCH REQUEST - CODE VERSION 2.0");
  console.log("Query:", queryText);
  console.log("=".repeat(60));

  try {
    console.log("\n=== SEARCH START ===");
    console.log("Query:", queryText);

    // Step 1: Get embeddings
    console.log("Step 1: Getting embeddings...");
    const denseVector = await getEmbedding(queryText);
    console.log("Dense vector length:", denseVector.length);
    console.log("First 5 values:", denseVector.slice(0, 5));

    const sparseVector = generateSparseVector(queryText);
    console.log("Sparse vector indices:", sparseVector.indices.length);
    console.log("Sparse vector values:", sparseVector.values.length);

    // Step 2: Try simple dense-only query first
    console.log("\nStep 2: Querying Pinecone (dense only)...");
    const index = getPineconeIndex();

    let queryResponse = await index.query({
      vector: denseVector,
      topK: 10,
      includeMetadata: true
    });

    console.log("Dense-only query returned:", queryResponse.matches?.length || 0, "matches");

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log("Sample match scores:", queryResponse.matches.slice(0, 3).map(m => m.score));
      console.log("Sample match titles:", queryResponse.matches.slice(0, 3).map(m => m.metadata?.title));
    }

    // If dense-only works, try hybrid
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log("\nStep 3: Trying hybrid search...");
      const alpha = 0.5;
      const weightedDense = denseVector.map(v => v * (1 - alpha));
      const weightedSparse = {
        indices: sparseVector.indices,
        values: sparseVector.values.map(v => v * alpha)
      };

      try {
        queryResponse = await index.query({
          vector: weightedDense,
          sparseVector: weightedSparse,
          topK: 50,
          includeMetadata: true
        });
        console.log("Hybrid query returned:", queryResponse.matches?.length || 0, "matches");
      } catch (hybridErr) {
        console.error("Hybrid query failed:", hybridErr.message);
        console.log("Falling back to dense-only results");
        // Keep the dense-only results
      }
    }

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      console.log("No matches found - returning empty");
      return res.json({ documents: [] });
    }

    console.log("\nStep 4: Deduplicating...");
    // Deduplicate - keep only best chunk per document
    const bestChunkPerDoc = new Map();
    for (const match of queryResponse.matches) {
      const docId = match.metadata?.docId;
      if (!docId) {
        console.log("Skipping match with no docId");
        continue;
      }

      if (!bestChunkPerDoc.has(docId) || match.score > bestChunkPerDoc.get(docId).score) {
        bestChunkPerDoc.set(docId, {
          docId: docId,
          text: match.metadata.text || "",
          title: match.metadata.title || "",
          authority: match.metadata.authority || "",
          year: match.metadata.year || "",
          docType: match.metadata.docType || "",
          pineconeScore: match.score
        });
      }
    }

    const uniqueCandidates = Array.from(bestChunkPerDoc.values());
    console.log("Unique documents:", uniqueCandidates.length);
    console.log("Document titles:", uniqueCandidates.map(d => d.title));

    // 2. RE-RANK WITH INTENT
    console.log("\nStep 5: Re-ranking with Voyage AI...");
    let rerankedResults = [];
    const queryLower = queryText.toLowerCase();
    const isAcademicQuery = /apply|research|grant|faculty|scholarship/i.test(queryLower);

    try {
      // We pass more context to Voyage so it understands the "Intent"
      console.log("Sending to Voyage for reranking:");
      uniqueCandidates.forEach((d, i) => {
        const preview = d.text.substring(0, 150).replace(/\n/g, ' ');
        console.log(`  [${i}] ${d.title}: "${preview}..."`);
      });

      const rerankResponse = await voyage.rerank({
        query: queryText,
        documents: uniqueCandidates.map(d => `Title: ${d.title}\nContent: ${d.text}`),
        topK: 15,
        model: "rerank-2"
      });

      console.log("Rerank successful, got", rerankResponse.data.length, "results");

      rerankedResults = rerankResponse.data.map(item => {
        const original = uniqueCandidates[item.index];
        // Voyage uses camelCase: relevanceScore, not relevance_score
        let finalScore = item.relevanceScore || item.relevance_score || item.score || 0.5;

        console.log(`  Voyage raw response for item:`, JSON.stringify(item).substring(0, 100));
        console.log(`  Reranked: ${original.title.substring(0, 40)}... score: ${finalScore.toFixed(3)}`);

        // INTENT GUARD: Penalize "Demand/Budget" docs if user is looking to "Apply"
        if (isAcademicQuery && /demand|budget|estimate|fiscal/i.test(original.title.toLowerCase())) {
          finalScore *= 0.2; // 80% penalty for fiscal mismatch
        }

        // Clean excerpt - remove injected metadata
        let cleanExcerpt = original.text
          .replace(/^Document:.*\n/m, '')
          .replace(/^Authority:.*\n/m, '')
          .replace(/^Type:.*\n/m, '')
          .replace(/^Year:.*\n/m, '')
          .trim();

        return {
          _id: original.docId,
          title: original.title,
          authority: original.authority,
          year: original.year,
          docType: original.docType,
          excerpt: cleanExcerpt,
          rawScore: finalScore
        };
      });
    } catch (err) {
      console.error("Rerank failed:", err.message);
      console.log("Using Pinecone scores as fallback");

      // Fallback uses original Pinecone scores with conservative scaling
      rerankedResults = uniqueCandidates.slice(0, 15).map(d => {
        // Pinecone dotproduct scores can be high, normalize more aggressively
        let score = Math.max(0, d.pineconeScore || 0) / 4.0; // More conservative: divide by 4 instead of 2

        if (isAcademicQuery && /demand|budget|estimate/i.test(d.title.toLowerCase())) {
          score *= 0.1;
        }
        console.log(`  Fallback: ${d.title.substring(0, 40)}... score: ${score.toFixed(3)}`);

        // Clean excerpt
        let cleanExcerpt = d.text
          .replace(/^Document:.*\n/m, '')
          .replace(/^Authority:.*\n/m, '')
          .replace(/^Type:.*\n/m, '')
          .replace(/^Year:.*\n/m, '')
          .trim();

        return {
          _id: d.docId,
          title: d.title,
          authority: d.authority,
          year: d.year,
          docType: d.docType,
          excerpt: cleanExcerpt,
          rawScore: score
        };
      });
    }

    console.log("\nTotal reranked results:", rerankedResults.length);

    // Sort by the new adjusted scores
    rerankedResults.sort((a, b) => b.rawScore - a.rawScore);

    // 3. FETCH DB INFO
    const docIds = rerankedResults.map(d => d._id);
    const dbDocs = await Document.find({ _id: { $in: docIds } }).select("fileUrl fileName");
    const dbDocMap = Object.fromEntries(dbDocs.map(d => [d._id.toString(), d]));

    // 4. CALCULATE DISPLAY SCORES with Query-Document Coverage Analysis
    /* ─── NEW DYNAMIC SCORING LOGIC ─── */
    console.log("\nStep 5: Calculating dynamic display scores...");

    /* ─── STEP 5: TRUE DYNAMIC SCORING ─── */
    let filtered = rerankedResults.map((doc, index) => {
      const dbInfo = dbDocMap[doc._id];
      doc.fileUrl = dbInfo?.fileUrl || null;
      doc.fileName = dbInfo?.fileName || null;

      // Use Voyage's score - balanced mapping for all query types
      const voyageScore = doc.rawScore;

      // Voyage scores interpretation:
      // 0.7+ = Excellent, 0.5-0.7 = Good, 0.3-0.5 = Moderate, <0.3 = Weak
      let displayScore;

      if (voyageScore >= 0.70) {
        // Excellent: 85-100%
        displayScore = 0.85 + ((voyageScore - 0.70) / 0.30) * 0.15;
      } else if (voyageScore >= 0.50) {
        // Good: 70-85%
        displayScore = 0.70 + ((voyageScore - 0.50) / 0.20) * 0.15;
      } else if (voyageScore >= 0.35) {
        // Moderate: 55-70%
        displayScore = 0.55 + ((voyageScore - 0.35) / 0.15) * 0.15;
      } else if (voyageScore >= 0.20) {
        // Weak: 40-55%
        displayScore = 0.40 + ((voyageScore - 0.20) / 0.15) * 0.15;
      } else {
        // Very weak: <40%
        displayScore = voyageScore * 2.0;
      }

      doc.score = Math.min(displayScore, 1.0);

      console.log(`SCORE -> ${doc.title.substring(0, 30)}... | Voyage: ${voyageScore.toFixed(3)} | Display: ${(doc.score * 100).toFixed(1)}%`);

      delete doc.rawScore;
      return doc;
    });

    // Final pruning - only show documents with meaningful relevance (>60%)
    filtered = filtered.filter(doc => doc.score >= 0.60).slice(0, 10);
    console.log(`Final results: ${filtered.length} documents\n`);

    // Handle language formatting
    filtered.forEach(doc => {
      const excerpt = doc.excerpt || "";
      const nonAsciiRatio = (excerpt.match(/[^\x00-\x7F]/g) || []).length / (excerpt.length || 1);
      if (nonAsciiRatio > 0.3) {
        doc.excerpt = "[Document content in Marathi/Hindi. Click 'View Context' for English summary.]";
      }
    });

    await new QueryHistory({
      queryText,
      topDocumentTitle: filtered[0]?.title || "N/A",
      results: filtered,
    }).save();

    // Add debug info to first result
    if (filtered.length > 0) {
      filtered[0]._debug = {
        message: "Score calculation working - CODE VERSION 2.0",
        queryLength: queryText.split(/\s+/).length,
        isShortQuery: queryText.split(/\s+/).length <= 5
      };
    }

    res.json({ documents: filtered });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Internal Search Error", error: error.message });
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

    const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

  if (!docId) {
    return res.status(400).json({ message: "docId is required" });
  }

  try {
    let chunkTexts = "";

    // ✅ 1. Use excerpt directly if available
    if (excerptText && excerptText.trim().length > 20 && !excerptText.startsWith("[")) {
      chunkTexts = excerptText;
    } else {
      // ✅ 2. Fetch chunks from Pinecone
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

      if (!vectorIds.length) {
        return res.json({ summary: "No content found." });
      }

      const allRecords = {};

      for (let i = 0; i < vectorIds.length; i += 100) {
        const batch = vectorIds.slice(i, i + 100);
        const fetched = await index.fetch({ ids: batch });
        Object.assign(allRecords, fetched.records ?? {});
      }

      chunkTexts = Object.values(allRecords)
        .sort((a, b) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0))
        .map(r => r.metadata?.text || "")
        .filter(t => t.trim().length > 0)
        .slice(0, 10) // limit for performance
        .join("\n\n");
    }

    // ✅ 3. Prompt
    const prompt = `You are an expert policy analyst for the Department of Higher Education.
Analyze the content below (English/Hindi/Marathi) and provide a structured summary in English.

Include:
- A 2-3 sentence overview
- Key points in bullet format
- Clear and simple language

DOCUMENT CONTENT:
${chunkTexts}

SUMMARY (in English):`;

    // ✅ 4. Gemini call
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const summaryText = result.response.text();

    if (!summaryText || summaryText.trim().length === 0) {
      throw new Error("Empty response from Gemini");
    }

    // ✅ 5. Send response
    res.json({ summary: summaryText });

  } catch (error) {
    console.error("=== SUMMARIZE ERROR ===");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    res.status(500).json({
      message: "Summarization failed",
      error: error.message,
    });
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