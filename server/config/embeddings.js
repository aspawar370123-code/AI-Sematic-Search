import { Pinecone } from "@pinecone-database/pinecone";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
import Tesseract from "tesseract.js";
import { fromBuffer } from "pdf2pic";
import natural from "natural";

const require = createRequire(import.meta.url);
const { VoyageAIClient } = require("voyageai");
const pdfParse = require("pdf-parse");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ai = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

/* PINECONE SETUP */
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const getIndex = () => pinecone.index(process.env.PINECONE_INDEX);

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F]/g, " ")
    .trim();
}
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
/**
 * MAIN PIPELINE: Processes PDF, generates 512-dim Voyage embeddings + BM25 sparse vectors.
 */
const processDocument = async (doc) => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[STEP 1] DOCUMENT UPLOAD PIPELINE STARTED`);
  console.log(`[STEP 1] Title    : ${doc.title}`);
  console.log(`${"=".repeat(50)}`);

  const rawText = await extractTextFromPDF(doc.fileUrl);
  const cleaned = cleanText(rawText);

// Inject title into every chunk for strong context
const baseChunks = chunkText(cleaned);

const allChunks = baseChunks.map(chunk => {
  return `Document: ${doc.title}
Authority: ${doc.authority}
Type: ${doc.docType}
Year: ${doc.year || "N/A"}

${chunk}`;
});
  const chunks = allChunks.filter(c => c.trim().length > 0);
  const totalChunks = chunks.length;

  if (totalChunks === 0) {
    console.error(`[STEP 4] ERROR: No valid chunks produced.`);
    return;
  }

  const BATCH_SIZE = 3;
  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`\n[STEP 5] Generating 512-dim Voyage embeddings for batch ${batchNum}...`);
    const embeddings = await generateEmbeddingsBatch(batch);

    const records = embeddings.map((values, j) => {
      const chunkIdx = i + j;
      const recordId = `${doc._id}-chunk-${chunkIdx}`;
      const cleanChunk = batch[j]
  .replace(/Document:.*\n/g, "")
  .replace(/Authority:.*\n/g, "")
  .replace(/Type:.*\n/g, "")
  .replace(/Year:.*\n/g, "");

      const sparseValues = generateSparseVector(batch[j]); // BM25 calculation

      return {
        id: recordId,
        values, // 512-dim Dense Vector
        sparseValues, // Sparse Vector
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

    await getIndex().upsert({ records });
    console.log(`[STEP 6] ✅ Batch ${batchNum} stored with Hybrid Vectors.`);

    if (i + BATCH_SIZE < totalChunks) {
      await sleep(25000);
    }
  }
};

const chunkText = (text, options = {}) => {
  const {
    maxWords = 350,   // balanced size (NOT too big)
    overlap = 80      // enough context carry-over
  } = options;

  // Step 1: Split into paragraphs first
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);

  const chunks = [];
  let currentChunk = [];
  let wordCount = 0;

  for (let para of paragraphs) {
    const sentences = para.split(/(?<=[.?!])\s+/);

    for (let sentence of sentences) {
      const words = sentence.split(/\s+/);
      const sentenceLength = words.length;

      // If adding sentence exceeds limit → push chunk
      if (wordCount + sentenceLength > maxWords) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(" "));
        }

        // Create overlap from previous chunk
        const overlapWords = currentChunk
          .join(" ")
          .split(/\s+/)
          .slice(-overlap);

        currentChunk = [overlapWords.join(" "), sentence];
        wordCount = overlapWords.length + sentenceLength;
      } else {
        currentChunk.push(sentence);
        wordCount += sentenceLength;
      }
    }

    // 🔥 HARD BOUNDARY: Don't mix unrelated paragraphs too much
    if (wordCount > maxWords * 0.8) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
      wordCount = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
};

/* EXTRACT TEXT FROM PDF */
const extractTextFromPDF = async (fileUrl) => {
  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);
  const parsed = await pdfParse(buffer);

  if (parsed.text && parsed.text.trim().length > 50) return parsed.text;

  const converter = fromBuffer(buffer, { density: 200, format: "png", width: 1654, height: 2339 });
  const pageTexts = [];
  for (let p = 1; p <= (parsed.numpages || 1); p++) {
    const page = await converter(p, { responseType: "buffer" });
    const { data: { text: pageText } } = await Tesseract.recognize(page.buffer, "eng+hin");
    pageTexts.push(pageText);
  }
  return pageTexts.join("\n");
};

/* GENERATE EMBEDDINGS */
const generateEmbeddingsBatch = async (texts, retries = 5) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await voyage.embed({ input: texts, model: "voyage-3-lite" });
      return result.data.map(d => d.embedding);
    } catch (err) {
      const status = err.statusCode ?? err.status ?? err.response?.status;
      if (status === 429 && attempt < retries) {
        await sleep(attempt * 25000);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
};

const generateEmbedding = async (text) => {
  const [embedding] = await generateEmbeddingsBatch([text]);
  return embedding;
};

/* QUERY DOCUMENTS */
const queryDocuments = async (question) => {
  const questionEmbedding = await generateEmbedding(question);

  const results = await getIndex().query({
    vector: questionEmbedding,
    topK: 20,
    includeMetadata: true,
  });

  if (!results.matches?.length) return { answer: "No relevant documents found.", sources: [] };

  const rerank = await voyage.rerank({
    query: question,
    documents: results.matches.map(m => m.metadata.text),
    topK: 5,
    model: "rerank-2"
  });

  const context = rerank.data
    .map(item => `[${results.matches[item.index].metadata.title}]:\n${item.document}`)
    .join("\n\n");

  const sources = rerank.data.map(item => ({
    title: results.matches[item.index].metadata.title,
    score: item.relevance_score
  }));

  const completion = await ai.generateContent({
    contents: [{ role: "user", parts: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }] }],
  });

  return { answer: completion.response.text(), sources };
};

export { processDocument, queryDocuments };