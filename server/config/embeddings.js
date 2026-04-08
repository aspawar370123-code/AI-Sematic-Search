const { Pinecone } = require("@pinecone-database/pinecone");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { VoyageAIClient } = require("voyageai");
const Tesseract = require("tesseract.js");
const { fromBuffer } = require("pdf2pic");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ai = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

/* PINECONE SETUP — lazy init so env vars are always current */
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const getIndex = () => pinecone.index(process.env.PINECONE_INDEX);

console.log("Pinecone index will use:", process.env.PINECONE_INDEX);
function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F]/g, " ")
    .trim();
}
// Add to your imports in embeddings.js
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

/**
 * HELPER: Generates a sparse vector for Hybrid Search (BM25 logic).
 * This must be present in the file for processDocument to work.
 */
const generateSparseVector = (text) => {
  const words = text.toLowerCase().match(/\w+/g) || [];
  const counts = {};
  words.forEach(word => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const index = Math.abs(hash) % 1000000;
    counts[index] = (counts[index] || 0) + 1;
  });
  return {
    indices: Object.keys(counts).map(Number),
    values: Object.values(counts).map(v => parseFloat(v.toFixed(2)))
  };
};

/**
 * MAIN PIPELINE: Processes PDF, generates 512-dim Voyage embeddings + BM25 sparse vectors,
 * and upserts them to your dotproduct Pinecone index.
 */
const processDocument = async (doc) => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[STEP 1] DOCUMENT UPLOAD PIPELINE STARTED`);
  console.log(`[STEP 1] Title    : ${doc.title}`);
  console.log(`[STEP 1] Doc ID   : ${doc._id}`);
  console.log(`${"=".repeat(50)}`);

  // Steps 2 & 3: Extract text from PDF
  const rawText = await extractTextFromPDF(doc.fileUrl);

  // Step 4: Chunking
  console.log(`\n[STEP 4] Starting chunking process...`);
  const allChunks = chunkText(cleanText(rawText));
  const chunks = allChunks.filter(c => c.trim().length > 0);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    console.error(`[STEP 4] ERROR: No valid chunks produced. Aborting.`);
    return;
  }

  // Steps 5 & 6: Embed + Upsert with Hybrid Logic
  const BATCH_SIZE = 3;
  const totalBatches = Math.ceil(totalChunks / BATCH_SIZE);
  let totalUploaded = 0;

  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\n[STEP 5] Generating 512-dim Voyage embeddings for batch ${batchNum}/${totalBatches}...`);
    const embeddings = await generateEmbeddingsBatch(batch);

    const records = embeddings.map((values, j) => {
      const chunkIdx = i + j;
      const recordId = `${doc._id}-chunk-${chunkIdx}`;
      
      // CRITICAL: Generate the sparse values for this specific chunk for Hybrid Search
      const sparseValues = generateSparseVector(batch[j]);

      return {
        id: recordId,
        values, // Voyage-3-lite Dense Vector (512 dims)
        sparseValues, // BM25 Sparse Vector
        metadata: {
          docId: doc._id.toString(),
          title: doc.title,
          authority: doc.authority,
          docType: doc.docType,
          year: doc.year ? doc.year.toString() : "N/A",
          chunkIndex: chunkIdx,
          text: batch[j],
        },
      };
    });

    // Upsert to the dotproduct index
    await getIndex().upsert({ records });
    totalUploaded += batch.length;
    console.log(`[STEP 6] ✅ Batch ${batchNum} stored in Pinecone with Hybrid Vectors.`);

    if (i + BATCH_SIZE < totalChunks) {
      console.log(`[WAIT] Voyage free tier rate limiting — waiting 25s...`);
      await sleep(25000);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`[DONE] PIPELINE COMPLETE | Total chunks: ${totalUploaded}`);
  console.log(`${"=".repeat(50)}\n`);
};
/* SPLIT TEXT INTO CHUNKS */
const chunkText = (text, chunkSize = 100) => {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    chunks.push(chunk);
  }
  return chunks;
};

/* EXTRACT TEXT FROM PDF */
const extractTextFromPDF = async (fileUrl) => {
  console.log(`[STEP 2] Downloading document from Cloudinary...`);
  console.log(`[STEP 2] URL: ${fileUrl}`);

  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  console.log(`[STEP 2] Download complete. File size: ${(buffer.length / 1024).toFixed(1)} KB`);

  console.log(`[STEP 3] Starting PDF text extraction...`);
  const parsed = await pdfParse(buffer);
  console.log(`[STEP 3] PDF parsed. Pages: ${parsed.numpages} | Raw text: ${parsed.text?.length || 0} chars`);

  if (parsed.text && parsed.text.trim().length > 50) {
    console.log(`[STEP 3] Text-based PDF. Extraction successful.`);
    return parsed.text;
  }

  console.log(`[STEP 3] Scanned PDF detected. Starting OCR...`);
  const converter = fromBuffer(buffer, { density: 200, format: "png", width: 1654, height: 2339 });
  const totalPages = parsed.numpages || 1;
  const pageTexts = [];

  for (let p = 1; p <= totalPages; p++) {
    console.log(`[OCR] Processing page ${p}/${totalPages}...`);
    const page = await converter(p, { responseType: "buffer" });
    const { data: { text: pageText } } = await Tesseract.recognize(page.buffer, "eng+hin");
    console.log(`[OCR] Page ${p} done. Chars extracted: ${pageText.length}`);
    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join("\n");
  console.log(`[STEP 3] OCR complete. Total chars: ${fullText.length}`);
  return fullText;
};

/* GENERATE EMBEDDING — Voyage AI voyage-3-lite (512 dims) */
const generateEmbeddingsBatch = async (texts, retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await voyage.embed({ input: texts, model: "voyage-3-lite" });
      return result.data.map(d => d.embedding);
    } catch (err) {
      const status = err.statusCode ?? err.status ?? err.response?.status;
      if (status === 429 && attempt < retries) {
        const wait = attempt * 25000; // 25s, 50s, 75s, 100s
        console.warn(`⚠️ Rate limited (attempt ${attempt}/${retries}). Waiting ${wait / 1000}s...`);
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded for batch embedding");
};

// Single-text helper used by queryDocuments
const generateEmbedding = async (text) => {
  const [embedding] = await generateEmbeddingsBatch([text]);
  return embedding;
};



/* QUERY DOCUMENTS */
const queryDocuments = async (question) => {
  console.log("=====================================");
  console.log("QUERY RECEIVED:", question);
  console.log("=====================================");

  const questionEmbedding = await generateEmbedding(question);

  console.log("Searching Pinecone...");

  const results = await getIndex().query({
    vector: questionEmbedding,
    topK: 5,
    includeMetadata: true,
  });

  if (!results.matches || results.matches.length === 0) {
    return { answer: "No relevant documents found.", sources: [] };
  }

  const context = results.matches
    .map(
      (m) =>
        `[${m.metadata.title} (${m.metadata.authority}, ${m.metadata.year})]:\n${m.metadata.text}`
    )
    .join("\n\n");

  const sources = [
    ...new Map(
      results.matches.map((m) => [
        m.metadata.docId,
        {
          title: m.metadata.title,
          authority: m.metadata.authority,
          year: m.metadata.year,
          docType: m.metadata.docType,
        },
      ])
    ).values(),
  ];

  const completion = await ai.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an AI assistant helping officers understand higher education policies.\n\nContext:\n${context}\n\nQuestion: ${question}`,
          },
        ],
      },
    ],
  });

  return {
    answer: completion.response.text(),
    sources,
  };
};

module.exports = { processDocument, queryDocuments };
