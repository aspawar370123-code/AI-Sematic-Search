const { Pinecone } = require("@pinecone-database/pinecone");
const pdfParse = require("pdf-parse");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { VoyageAIClient } = require("voyageai");
const Tesseract = require("tesseract.js");
const { fromBuffer } = require("pdf2pic");
const natural = require('natural'); // Declared only ONCE here

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const ai = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
  const words = tokenizer.tokenize(text.toLowerCase()) || [];
  const counts = {};
  words.forEach(word => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0; // Convert to 32-bit integer
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

/* SPLIT TEXT INTO CHUNKS */
const chunkText = (text, options = {}) => {
  const {
    maxWords = 200,
    overlap = 40
  } = options;

  // Split into sentences (better than words)
  const sentences = text.split(/(?<=[.?!])\s+/);

  const chunks = [];
  let currentChunk = [];
  let wordCount = 0;

  for (let sentence of sentences) {
    const words = sentence.split(/\s+/);
    const sentenceLength = words.length;

    // If adding this sentence exceeds limit → push chunk
    if (wordCount + sentenceLength > maxWords) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
      }

      // Start new chunk with overlap
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

module.exports = { processDocument, queryDocuments };