import dotenv from "dotenv";
dotenv.config();

import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX);

async function cleanupTest5() {
  try {
    console.log("Starting cleanup for test5 (ID: 69df31b16afcf4aba08025df)...");
    
    const docId = "69df31b16afcf4aba08025df";
    let allVectorIds = [];
    let paginationToken = undefined;
    
    // Find all vectors with this document ID prefix
    do {
      const listResponse = await index.listPaginated({
        prefix: `${docId}-`,
        limit: 100,
        ...(paginationToken && { paginationToken })
      });
      
      const vectorIds = (listResponse.vectors || []).map(v => v.id);
      allVectorIds.push(...vectorIds);
      
      paginationToken = listResponse.pagination?.next;
      
      console.log(`Found ${vectorIds.length} vectors in this batch`);
    } while (paginationToken);
    
    console.log(`\nTotal vectors found: ${allVectorIds.length}`);
    
    if (allVectorIds.length > 0) {
      console.log("Deleting vectors using fetch and delete...");
      
      // Try fetching first to verify IDs exist
      const sampleFetch = await index.fetch({ ids: [allVectorIds[0]] });
      console.log("Sample fetch result:", Object.keys(sampleFetch.records || {}));
      
      // Use namespace delete if all vectors are in default namespace
      console.log("\nAttempting namespace-based deletion...");
      
      // Delete by filter using metadata
      try {
        await index.deleteMany({
          filter: { docId: { $eq: docId } }
        });
        console.log(`✅ Successfully deleted vectors using metadata filter`);
      } catch (filterErr) {
        console.log("Filter delete failed, trying direct ID array...");
        
        // Last resort: try with proper ID format
        try {
          await index._deleteMany(allVectorIds);
          console.log(`✅ Successfully deleted ${allVectorIds.length} vectors`);
        } catch (err) {
          console.error("All delete methods failed:", err.message);
        }
      }
    } else {
      console.log("⚠️ No vectors found for test5");
    }
    
  } catch (error) {
    console.error("❌ Cleanup failed:", error.message);
    process.exit(1);
  }
}

cleanupTest5();
