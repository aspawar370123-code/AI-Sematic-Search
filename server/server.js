import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import https from "https";
import { Pinecone } from "@pinecone-database/pinecone";
import { createRequire } from "module";
import natural from "natural";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

// Internal Modules
import QueryHistory from "./models/QueryHistory.js";
import Document from "./models/Document.js";
import Admin from "./models/Admin.js";
import Officer from "./models/Officer.js";
import { processDocument, queryDocuments } from "./config/embeddings.js";
import upload from "./config/multerCloudinary.js";
import cloudinary from "./config/cloudinary.js";

const app = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors({
  origin: true, // reflects the request origin — allows any origin including localhost and deployed frontend
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
  credentials: true
}));
app.options("/{*path}", cors()); // handle preflight for all routes
app.use(express.json());
import axios from "axios";

// Embedding service URL - use environment variable for production
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:5001";

export const rerankDocs = async (query, documents) => {
  const res = await axios.post(`${EMBEDDING_SERVICE_URL}/rerank`, {
    query,
    documents,
  });

  return res.data.results;
};
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
  const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:5001";
  const res = await axios.post(`${EMBEDDING_SERVICE_URL}/embed`, {
    texts: ["query: " + text]
  });

  return res.data.embeddings[0];
};

/* ─── Routes ─────────────────────────────────────────────────── */

app.get("/", (req, res) => res.json({
  status: "running",
  message: "AI Document System API",
  endpoints: {
    health: "/health",
    testPinecone: "/test-pinecone",
    upload: "/upload",
    documents: "/documents",
    search: "/api/officer/search",
    ask: "/api/officer/ask"
  }
}));

app.get("/health", (req, res) => res.json({ status: "healthy", timestamp: new Date().toISOString() }));

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

// Admin creation route - only for existing admins (no public registration)
app.post("/admin/create", async (req, res) => {
  const { email, password, createdBy } = req.body;
  try {
    if (!email || !password || !createdBy) {
      return res.status(400).json({ message: "All fields required" });
    }
    if (await Admin.findOne({ email })) {
      return res.status(400).json({ message: "Admin already exists" });
    }
    await new Admin({
      email,
      password,
      createdBy,
      createdAt: new Date()
    }).save();
    res.json({ message: "Admin account created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all admins
app.get("/admin/list", async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admins" });
  }
});

// Delete admin
app.delete("/admin/:id", async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
});

/* Officer Routes */
app.post("/officer/register", async (req, res) => {
  const { name, designation, email, password } = req.body;
  try {
    if (await Officer.findOne({ email }))
      return res.status(400).json({ message: "Officer already registered" });
    
    // Create officer with approved=false (default)
    await new Officer({ name, designation, email, password, approved: false }).save();
    
    res.json({ 
      message: "Registration request submitted successfully. You will receive access once approved by the administrator." 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/officer/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const officer = await Officer.findOne({ email });
    if (!officer || officer.password !== password)
      return res.status(401).json({ message: "Invalid credentials" });
    
    // Check if officer is approved
    if (!officer.approved) {
      return res.status(403).json({ 
        message: "Your account is pending approval. Please wait for administrator authorization." 
      });
    }
    
    await Officer.findByIdAndUpdate(officer._id, { lastActiveAt: new Date() });
    res.json({ message: "Login successful", officer: { name: officer.name, designation: officer.designation } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Get pending officers (for admin)
app.get("/admin/officers/pending", async (req, res) => {
  try {
    const pending = await Officer.find({ approved: false }).sort({ createdAt: -1 });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pending officers" });
  }
});

// Get all officers (for admin)
app.get("/admin/officers", async (req, res) => {
  try {
    const officers = await Officer.find().sort({ createdAt: -1 });
    res.json(officers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch officers" });
  }
});

// Approve officer
app.patch("/admin/officers/:id/approve", async (req, res) => {
  const { approvedBy } = req.body;
  try {
    const officer = await Officer.findByIdAndUpdate(
      req.params.id,
      { 
        approved: true, 
        approvedBy: approvedBy,
        approvedAt: new Date() 
      },
      { new: true }
    );
    if (!officer) {
      return res.status(404).json({ message: "Officer not found" });
    }
    res.json({ message: "Officer approved successfully", officer });
  } catch (error) {
    res.status(500).json({ message: "Approval failed", error: error.message });
  }
});

// Reject/Delete officer
app.delete("/admin/officers/:id", async (req, res) => {
  try {
    const officer = await Officer.findByIdAndDelete(req.params.id);
    if (!officer) {
      return res.status(404).json({ message: "Officer not found" });
    }
    res.json({ message: "Officer request rejected" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
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

    console.log(`\n=== DELETING DOCUMENT: ${req.params.id} ===`);

    // 1. Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(doc.cloudinaryId);
      console.log("✓ Deleted from Cloudinary");
    } catch (err) {
      console.error("Cloudinary delete failed, trying raw...", err.message);
      try {
        await cloudinary.uploader.destroy(doc.cloudinaryId, { resource_type: "raw" });
        console.log("✓ Deleted from Cloudinary (raw)");
      } catch (err2) {
        console.error("Cloudinary cleanup failed completely:", err2.message);
      }
    }

    // 2. Delete from Pinecone - with proper pagination
    try {
      const index = getPineconeIndex();
      let allVectorIds = [];
      let paginationToken = undefined;

      console.log(`Searching for vectors with prefix: ${req.params.id}-`);

      // Paginate through all vectors with this document ID
      do {
        const listResponse = await index.listPaginated({
          prefix: `${req.params.id}-`,
          limit: 100,
          ...(paginationToken && { paginationToken })
        });

        const vectorIds = (listResponse.vectors || []).map(v => v.id);
        allVectorIds.push(...vectorIds);

        paginationToken = listResponse.pagination?.next;

        console.log(`Found ${vectorIds.length} vectors in this batch`);
      } while (paginationToken);

      if (allVectorIds.length > 0) {
        console.log(`Deleting ${allVectorIds.length} total vectors from Pinecone...`);

        // Delete in batches of 100 (Pinecone limit)
        for (let i = 0; i < allVectorIds.length; i += 100) {
          const batch = allVectorIds.slice(i, i + 100);

          try {
            // Pinecone deleteMany expects just the array of IDs
            await index.deleteMany(batch);
            console.log(`✓ Deleted batch ${Math.floor(i / 100) + 1} (${batch.length} vectors)`);
          } catch (batchErr) {
            console.error(`❌ Failed to delete batch ${Math.floor(i / 100) + 1}:`, batchErr.message);
            // Try alternative method: delete by filter
            try {
              console.log("Trying alternative delete method...");
              for (const id of batch) {
                await index.deleteOne(id);
              }
              console.log(`✓ Deleted batch ${Math.floor(i / 100) + 1} using deleteOne`);
            } catch (altErr) {
              console.error("Alternative delete also failed:", altErr.message);
            }
          }
        }

        console.log(`✓ All ${allVectorIds.length} vectors deleted from Pinecone`);
      } else {
        console.log("⚠️ No vectors found in Pinecone for this document");
      }
    } catch (vectorErr) {
      console.error("❌ Pinecone cleanup failed:", vectorErr.message);
      // Don't fail the whole delete if Pinecone fails
    }

    // 3. Delete from MongoDB
    await Document.findByIdAndDelete(req.params.id);
    console.log("✓ Deleted from MongoDB");
    console.log("=== DELETE COMPLETE ===\n");

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
  const startTime = Date.now();

  if (!queryText?.trim()) {
    return res.status(400).json({ message: "Query text is required" });
  }

  console.log("\n" + "=".repeat(60));
  console.log("ADVANCED SEARCH - Multi-Query + RRF Fusion");
  console.log("Query:", queryText);
  console.log("=".repeat(60));

  try {
    const index = getPineconeIndex();

    // STEP 1: Decompose query into sub-queries
    console.log("\n[1/6] Decomposing query into sub-queries...");
    const subQueries = [queryText]; // Start with original

    // Generate 2-3 variations
    const words = queryText.toLowerCase().split(/\s+/);
    const hasYear = words.some(w => /\d{4}/.test(w));
    const hasDocument = words.some(w => ['report', 'policy', 'document', 'scheme'].includes(w));

    // Variation 1: Simplified (remove filler words)
    const simplified = words
      .filter(w => !['what', 'are', 'the', 'is', 'in', 'of', 'as', 'listed'].includes(w))
      .join(' ');
    if (simplified !== queryText.toLowerCase()) {
      subQueries.push(simplified);
    }

    // Variation 2: Focus on key terms
    const keyTerms = words.filter(w => w.length > 4).slice(0, 5).join(' ');
    if (keyTerms && keyTerms !== simplified) {
      subQueries.push(keyTerms);
    }

    // Variation 3: If mentions document type, create focused query
    if (hasDocument) {
      const docFocused = words.filter(w =>
        !['what', 'are', 'the', 'how', 'when', 'where'].includes(w)
      ).join(' ');
      if (docFocused !== queryText.toLowerCase() && !subQueries.includes(docFocused)) {
        subQueries.push(docFocused);
      }
    }

    console.log(`Generated ${subQueries.length} sub-queries:`);
    subQueries.forEach((q, i) => console.log(`  ${i + 1}. "${q}"`));

    // STEP 2: Retrieve top-20 per sub-query
    console.log("\n[2/6] Retrieving chunks for each sub-query...");
    const allChunks = new Map(); // Use Map to deduplicate by chunk ID

    for (let i = 0; i < subQueries.length; i++) {
      const subQuery = subQueries[i];
      console.log(`  Query ${i + 1}/${subQueries.length}: "${subQuery.substring(0, 50)}..."`);

      const embedding = await getEmbedding(subQuery);
      const response = await index.query({
        vector: embedding,
        topK: 20,
        includeMetadata: true
      });

      response.matches?.forEach((match, rank) => {
        const chunkId = match.id;
        if (!allChunks.has(chunkId)) {
          allChunks.set(chunkId, {
            id: chunkId,
            docId: match.metadata?.docId,
            text: match.metadata?.text || "",
            title: match.metadata?.title || "",
            authority: match.metadata?.authority || "",
            year: match.metadata?.year || "",
            docType: match.metadata?.docType || "",
            pineconeScore: match.score,
            pineconeRank: rank + 1, // Track rank for RRF
            retrievedBy: [i] // Track which sub-query found it
          });
        } else {
          // Chunk found by multiple queries - boost it
          allChunks.get(chunkId).retrievedBy.push(i);
        }
      });
    }

    const chunks = Array.from(allChunks.values()).filter(c => c.docId && c.text);
    console.log(`✓ Retrieved ${chunks.length} unique chunks (after deduplication)`);
    console.log(`  Chunks found by multiple queries: ${chunks.filter(c => c.retrievedBy.length > 1).length}`);

    if (chunks.length === 0) {
      console.log("✗ No chunks found");
      return res.json({ documents: [] });
    }

    // STEP 3: Enrich chunks with metadata hints
    console.log("\n[3/6] Enriching chunks with metadata...");
    const enrichedChunks = chunks.map(chunk => {
      const metadata = `[Source: ${chunk.title} | Type: ${chunk.docType} | Authority: ${chunk.authority}]`;
      return {
        ...chunk,
        enrichedText: `${metadata}\n\n${chunk.text}`,
        originalText: chunk.text
      };
    });

    console.log(`✓ Enriched ${enrichedChunks.length} chunks with metadata`);

    // STEP 4: Rerank with Jina
    console.log("\n[4/6] Reranking chunks with Jina...");
    const t4 = Date.now();

    // Truncate enriched text for reranker (max 1000 chars)
    const textsForRerank = enrichedChunks.map(c =>
      c.enrichedText.length > 1000
        ? c.enrichedText.substring(0, 1000) + '...'
        : c.enrichedText
    );

    const reranked = await rerankDocs(queryText, textsForRerank);
    console.log(`✓ Reranking completed in ${Date.now() - t4}ms`);

    // Attach rerank scores and ranks
    enrichedChunks.forEach((chunk, idx) => {
      chunk.rerankScore = reranked[idx]?.score || 0;
    });

    // Sort by rerank score to get ranks
    const sortedByRerank = [...enrichedChunks].sort((a, b) => b.rerankScore - a.rerankScore);
    sortedByRerank.forEach((chunk, idx) => {
      chunk.rerankRank = idx + 1;
    });

    console.log("\nTop 5 after reranking:");
    sortedByRerank.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. [${c.rerankScore.toFixed(4)}] ${c.title}`);
    });

    // STEP 5: Apply source-mention multiplier
    console.log("\n[5/6] Applying source-mention boost...");
    const queryLower = queryText.toLowerCase();
    const mentionedDocs = [];

    // Detect if query mentions specific documents
    enrichedChunks.forEach(chunk => {
      const titleWords = chunk.title.toLowerCase().split(/\s+/);
      const matchedWords = titleWords.filter(word =>
        word.length > 3 && queryLower.includes(word)
      );

      if (matchedWords.length >= 2) {
        chunk.sourceBoost = 1.3; // 30% boost
        if (!mentionedDocs.includes(chunk.title)) {
          mentionedDocs.push(chunk.title);
        }
      } else {
        chunk.sourceBoost = 1.0;
      }
    });

    if (mentionedDocs.length > 0) {
      console.log(`✓ Boosting ${mentionedDocs.length} explicitly mentioned documents:`);
      mentionedDocs.forEach(doc => console.log(`  - ${doc} (1.3x boost)`));
    } else {
      console.log(`  No specific documents mentioned in query`);
    }

    // STEP 6: RRF Fusion
    console.log("\n[6/6] Applying RRF fusion...");
    const k = 30; // RRF constant (lower = more emphasis on top ranks)

    enrichedChunks.forEach(chunk => {
      // RRF formula: 1/(k + rank)
      const pineconeRRF = 1 / (k + chunk.pineconeRank);
      const rerankRRF = 1 / (k + chunk.rerankRank);

      // Multi-query bonus: chunks found by multiple queries get boost
      const multiQueryBoost = 1 + (chunk.retrievedBy.length - 1) * 0.1; // +10% per extra query

      // Combined RRF score with source boost
      chunk.rrfScore = (pineconeRRF + rerankRRF) * chunk.sourceBoost * multiQueryBoost;
    });

    // Sort by final RRF score
    enrichedChunks.sort((a, b) => b.rrfScore - a.rrfScore);

    console.log("\nTop 10 after RRF fusion:");
    enrichedChunks.slice(0, 10).forEach((c, i) => {
      const boost = c.sourceBoost > 1 ? ' [BOOSTED]' : '';
      const multi = c.retrievedBy.length > 1 ? ` [${c.retrievedBy.length}x]` : '';
      console.log(`  ${i + 1}. [${c.rrfScore.toFixed(4)}] ${c.title}${boost}${multi}`);
    });

    // Group by document - keep BEST chunk per document
    console.log("\n[7/6] Grouping by document...");
    const docChunksMap = new Map();

    // First, group all chunks by document
    enrichedChunks.forEach(chunk => {
      if (!docChunksMap.has(chunk.docId)) {
        docChunksMap.set(chunk.docId, []);
      }
      docChunksMap.get(chunk.docId).push(chunk);
    });

    // Then, for each document, select the chunk with HIGHEST rerank score
    let results = [];
    docChunksMap.forEach((chunks, docId) => {
      // Sort by rerank score (most important metric)
      chunks.sort((a, b) => b.rerankScore - a.rerankScore);
      const bestChunk = chunks[0];

      results.push({
        _id: docId,
        title: bestChunk.title,
        authority: bestChunk.authority,
        year: bestChunk.year,
        docType: bestChunk.docType,
        excerpt: bestChunk.originalText,
        rrfScore: bestChunk.rrfScore,
        rerankScore: bestChunk.rerankScore, // Use BEST chunk's rerank score
        pineconeScore: bestChunk.pineconeScore,
        sourceBoost: bestChunk.sourceBoost,
        retrievedByCount: bestChunk.retrievedBy.length,
        totalChunks: chunks.length // Track how many chunks this document has
      });
    });

    // CHUNK FREQUENCY BOOST: Smart boosting using RRF scores
    console.log("\n[8/6] Applying smart chunk frequency boost...");

    // Get top 10 chunks by rerank score
    const top10Chunks = [...enrichedChunks]
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, 10);

    // Count frequency and calculate average RRF per document
    const docStats = {};
    top10Chunks.forEach(chunk => {
      if (!docStats[chunk.docId]) {
        docStats[chunk.docId] = { frequency: 0, rrfScores: [] };
      }
      docStats[chunk.docId].frequency++;
      docStats[chunk.docId].rrfScores.push(chunk.rrfScore);
    });

    // Apply smart boost to documents - boost BOTH rrfScore and rerankScore
    results.forEach(doc => {
      const stats = docStats[doc._id];
      if (!stats) return; // Document not in top 10

      const frequency = stats.frequency;
      const avgRRF = stats.rrfScores.reduce((sum, s) => sum + s, 0) / stats.rrfScores.length;
      const multiQueryCount = doc.retrievedByCount;
      const baseScore = doc.rerankScore;

      // Apply boost if: 3+ chunks and 2+ queries (removed upper score limit)
      if (frequency >= 3 && multiQueryCount >= 2 && baseScore >= 0.3) {

        // Smart boost formula: considers frequency, RRF agreement, and multi-query
        let boost = (frequency * 0.03) + (multiQueryCount * 0.05) + (avgRRF * 0.1);

        // Reduce boost for scores already close to or above threshold
        if (baseScore >= 0.6) {
          boost = boost * 0.50; // 50% of boost for already confident scores (60%+)
        } else if (baseScore >= 0.55) {
          boost = boost * 0.60; // 60% of boost for 55-60%
        } else if (baseScore >= 0.5) {
          boost = boost * 0.65; // 65% of boost for 50-55%
        }
        // else: full boost for scores 30-50%

        const oldRerankScore = doc.rerankScore;
        const oldRrfScore = doc.rrfScore;

        // Apply boost to BOTH scores
        doc.rerankScore = Math.min(doc.rerankScore + boost, 0.95); // Cap at 95%
        doc.rrfScore = doc.rrfScore * (1 + boost); // Proportional boost to rrfScore

        console.log(`  ✓ Boosted "${doc.title.substring(0, 40)}..."`);
        console.log(`    - ${frequency} chunks in top 10, avg RRF: ${avgRRF.toFixed(4)}, ${multiQueryCount} queries`);
        console.log(`    - Rerank: ${(oldRerankScore * 100).toFixed(1)}% → ${(doc.rerankScore * 100).toFixed(1)}%`);
        console.log(`    - RRF: ${oldRrfScore.toFixed(4)} → ${doc.rrfScore.toFixed(4)} (+${(boost * 100).toFixed(1)}%)`);
      } else if (frequency >= 3 && multiQueryCount >= 2) {
        // Log why boost wasn't applied
        if (baseScore < 0.3) {
          console.log(`  ⊘ Skipped "${doc.title.substring(0, 40)}..." - base score too low (${(baseScore * 100).toFixed(1)}%)`);
        }
      }
    });

    // Sort by rerank score (now includes frequency boost)
    results.sort((a, b) => b.rerankScore - a.rerankScore);

    console.log(`\nFound ${results.length} unique documents`);

    // STRICT FILTERING: Hard 60% threshold - only show highly relevant documents
    const filtered = results.filter(doc => doc.rerankScore >= 0.60);

    if (filtered.length === 0) {
      console.log(`⚠️ No documents meet 60% relevance threshold`);

      // Save to history even when no results
      await new QueryHistory({
        queryText: queryText,
        topDocumentTitle: null,
        results: []
      }).save();

      return res.json({
        documents: [],
        message: "No sufficiently relevant documents found. Try rephrasing your query with more specific terms."
      });
    }

    console.log(`Filtered to ${filtered.length} documents (60%+ threshold)`);

    // Show top 5 documents max
    results = filtered.slice(0, 5);

    // Calculate percentages based on ACTUAL rerank scores, not relative distribution
    if (results.length === 1) {
      // Single document: show its actual confidence (rerank score * 100)
      const doc = results[0];
      doc.scorePercent = doc.rerankScore * 100; // 0.766 -> 76.6%
      doc.score = doc.rerankScore;
      console.log(`Single result: showing actual confidence ${doc.scorePercent.toFixed(1)}%`);
    } else {
      // Multiple documents: normalize to sum to 100%
      const totalScore = results.reduce((sum, d) => sum + d.rrfScore, 0);
      results.forEach(doc => {
        doc.score = doc.rrfScore / totalScore;
        doc.scorePercent = (doc.rrfScore / totalScore) * 100;
      });

      // Verify sum is 100%
      const sumCheck = results.reduce((sum, d) => sum + d.scorePercent, 0);
      console.log(`Score distribution check: ${sumCheck.toFixed(2)}% (should be 100%)`);
    }

    // Fetch file URLs from MongoDB
    const docIds = results.map(r => r._id);
    const dbDocs = await Document.find({ _id: { $in: docIds } }).lean();
    const dbMap = Object.fromEntries(dbDocs.map(d => [d._id.toString(), d]));

    results = results.map(doc => {
      const dbInfo = dbMap[doc._id];
      doc.fileUrl = dbInfo?.fileUrl || null;
      doc.fileName = dbInfo?.fileName || null;

      const boost = doc.sourceBoost > 1 ? ' [BOOSTED]' : '';
      const confidence = doc.rerankScore >= 0.6 ? 'HIGH' : doc.rerankScore >= 0.4 ? 'GOOD' : 'MODERATE';
      console.log(`  → ${doc.title.substring(0, 40)}... | ${doc.scorePercent.toFixed(1)}% | Rerank: ${doc.rerankScore.toFixed(3)} (${confidence})${boost}`);
      return doc;
    });

    console.log(`\n⏱ Total time: ${Date.now() - startTime}ms`);

    // Save to history
    await new QueryHistory({
      queryText: queryText,
      topDocumentTitle: results.length > 0 ? results[0].title : null,
      results: results.map(d => ({
        _id: d._id,
        title: d.title,
        authority: d.authority,
        year: d.year,
        docType: d.docType,
        excerpt: d.excerpt,
        score: d.score,  // This is what SearchPolicy uses for the score bar
        scorePercent: d.scorePercent,
        rerankScore: d.rerankScore,
        fileUrl: d.fileUrl,
        fileName: d.fileName
      }))
    }).save();

    res.json({ documents: results });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});

/* Summarize endpoint - generates AI summary of document excerpt */
app.post("/api/officer/summarize", async (req, res) => {
  const { docId, excerptText } = req.body;

  if (!docId || !excerptText) {
    return res.status(400).json({ message: "Document ID and excerpt text are required" });
  }

  console.log(`\n=== SUMMARIZE REQUEST ===`);
  console.log(`Document ID: ${docId}`);
  console.log(`Excerpt length: ${excerptText.length} chars`);

  try {
    // Use Groq to generate a summary of the excerpt
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert policy analyst. Your task is to provide a clear, structured summary of policy document excerpts. 
          
Guidelines:
- If the text is in Hindi or Marathi, translate it to English
- Extract key points, requirements, and actionable information
- Use bullet points and numbered lists for clarity
- Highlight important terms in **bold**
- Keep the summary concise but comprehensive
- Focus on practical information that officers need to know`
        },
        {
          role: "user",
          content: `Summarize this policy document excerpt:\n\n${excerptText}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1024,
    });

    const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";

    console.log(`✓ Summary generated (${summary.length} chars)`);
    console.log(`=== SUMMARIZE COMPLETE ===\n`);

    res.json({ summary });

  } catch (error) {
    console.error("Summarize error:", error);
    res.status(500).json({
      message: "Failed to generate summary",
      error: error.message
    });
  }
});



/* Query History */
app.get("/api/officer/history", async (req, res) => {
  try {
    const history = await QueryHistory.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(); // Convert to plain objects for modification

    // Handle backward compatibility: map old 'query' field to 'queryText'
    const mappedHistory = history.map(item => ({
      ...item,
      queryText: item.queryText || item.query || "Unknown Query",
      topDocumentTitle: item.topDocumentTitle || (item.results && item.results[0]) || "Multiple Sources"
    }));

    res.json(mappedHistory);
  } catch (error) {
    console.error("History fetch error:", error);
    res.status(500).json({ message: "Failed to fetch history", error: error.message });
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

// Serve static files from React app
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all route: serve index.html for any route not handled by API
// This MUST be the last route - it handles all non-API routes for React Router
app.use((req, res, next) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/officer') ||
    req.path.startsWith('/upload') ||
    req.path.startsWith('/documents') ||
    req.path.startsWith('/query') ||
    req.path.startsWith('/stats') ||
    req.path.startsWith('/health') ||
    req.path.startsWith('/test-pinecone')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  // Serve index.html for all other routes (React Router will handle them)
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
