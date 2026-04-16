import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { Pinecone } from "@pinecone-database/pinecone";
import Document from "./models/Document.js";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX);

async function renameTest8() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB");

    // Find test8 document
    const doc = await Document.findOne({ title: "test8" });
    
    if (!doc) {
      console.log("❌ Document 'test8' not found");
      process.exit(1);
    }

    console.log(`Found document: ${doc.title} (ID: ${doc._id})`);

    // Update in MongoDB
    doc.title = "Annual Report";
    await doc.save();
    console.log("✓ Updated title in MongoDB");

    // Update all chunks in Pinecone
    console.log("\nUpdating Pinecone chunks...");
    let allVectorIds = [];
    let paginationToken = undefined;

    // Get all vectors for this document
    do {
      const listResponse = await index.listPaginated({
        prefix: `${doc._id}-`,
        limit: 100,
        ...(paginationToken && { paginationToken })
      });

      const vectorIds = (listResponse.vectors || []).map(v => v.id);
      allVectorIds.push(...vectorIds);
      paginationToken = listResponse.pagination?.next;

      console.log(`  Found ${vectorIds.length} vectors in this batch`);
    } while (paginationToken);

    console.log(`\nTotal vectors to update: ${allVectorIds.length}`);

    // Update metadata for all vectors
    for (const vectorId of allVectorIds) {
      await index.update({
        id: vectorId,
        metadata: { title: "Annual Report" }
      });
    }

    console.log(`✓ Updated ${allVectorIds.length} vectors in Pinecone`);
    console.log("\n✅ Rename complete!");
    console.log("test8 → Annual Report");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

renameTest8();
