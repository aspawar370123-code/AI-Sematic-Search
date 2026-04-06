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
/* SPLIT TEXT INTO CHUNKS */
const chunkText = (text, chunkSize = 200) => {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }

  console.log("Chunking complete");
  console.log("Total words:", words.length);
  console.log("Total chunks created:", chunks.length);

  return chunks;
};

/* EXTRACT TEXT FROM PDF */
const extractTextFromPDF = async (fileUrl) => {
  console.log("Downloading PDF from:", fileUrl);

  const response = await axios.get(fileUrl, {
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(response.data);

  const parsed = await pdfParse(buffer);

  if (parsed.text && parsed.text.trim().length > 50) {
    console.log("PDF text extracted successfully (text-based)");
    return parsed.text;
  }

  console.log("PDF appears scanned. Running OCR...");

  const converter = fromBuffer(buffer, {
    density: 200,
    format: "png",
    width: 1654,
    height: 2339,
  });

  const totalPages = parsed.numpages || 1;
  const pageTexts = [];

  for (let p = 1; p <= totalPages; p++) {
    console.log(`OCR processing page ${p}/${totalPages}`);

    const page = await converter(p, { responseType: "buffer" });

    const {
      data: { text: pageText },
    } = await Tesseract.recognize(page.buffer, "eng+hin");

    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join("\n");

  console.log("OCR complete. Extracted length:", fullText.length);

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

const processDocument = async (doc) => {
  console.log("=====================================");
  console.log("PROCESSING DOCUMENT:", doc.title);
  console.log("=====================================");

  const rawText = await extractTextFromPDF(doc.fileUrl);
  const chunks = chunkText(cleanText(rawText)).filter(c => c.trim().length > 0);
  const totalChunks = chunks.length;
  const BATCH_SIZE = 3;

  console.log(`Total chunks to embed: ${totalChunks}`);

  for (let i = 0; i < totalChunks; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalChunks / BATCH_SIZE);

    console.log(`Embedding batch ${batchNum}/${totalBatches} (chunks ${i + 1}–${Math.min(i + BATCH_SIZE, totalChunks)})`);

    const embeddings = await generateEmbeddingsBatch(batch); // retries built-in

    await getIndex().upsert({
      records: embeddings.map((values, j) => ({
        id: `${doc._id}-chunk-${i + j}`,
        values,
        metadata: {
          docId: doc._id.toString(),
          title: doc.title,
          authority: doc.authority,
          docType: doc.docType,
          year: doc.year ? doc.year.toString() : "N/A",
          chunkIndex: i + j,
          text: batch[j],
        },
      })),
    });

    console.log(`✅ Batch ${batchNum}/${totalBatches} stored`);

    // Voyage free tier = 3 RPM — wait 25s between batches
    if (i + BATCH_SIZE < totalChunks) {
      console.log("⏳ Waiting 25s (Voyage free tier: 3 RPM)...");
      await sleep(25000);
    }
  }

  console.log("=====================================");
  console.log("DOCUMENT EMBEDDING COMPLETE");
  console.log("=====================================");
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
