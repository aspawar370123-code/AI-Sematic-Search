// SIMPLIFIED SEARCH LOGIC - Pure Semantic + Reranker
// Replace the search endpoint in server.js with this logic

/*
SIMPLE APPROACH:
1. Get embeddings for query
2. Retrieve top 100 chunks from Pinecone (pure semantic search)
3. Rerank all chunks with Jina
4. Group by document, keep best chunk per document
5. Show top 3-5 documents based on rerank scores
*/

app.post("/api/officer/search", async (req, res) => {
  const { queryText } = req.body;
  const startTime = Date.now();

  if (!queryText?.trim()) {
    return res.status(400).json({ message: "Query text is required" });
  }

  console.log("\n" + "=".repeat(60));
  console.log("SEARCH - Pure Semantic + Reranker");
  console.log("Query:", queryText);
  console.log("=".repeat(60));

  try {
    // Step 1: Get embeddings
    console.log("\n[1/5] Getting embeddings...");
    const denseVector = await getEmbedding(queryText);
    console.log(`✓ Done (${denseVector.length}d vector)`);

    // Step 2: Semantic search in Pinecone
    console.log("\n[2/5] Querying Pinecone (semantic search)...");
    const index = getPineconeIndex();
    const queryResponse = await index.query({
      vector: denseVector,
      topK: 100,
      includeMetadata: true
    });

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      console.log("✗ No matches found");
      return res.json({ documents: [] });
    }

    console.log(`✓ Retrieved ${queryResponse.matches.length} chunks`);

    // Step 3: Prepare chunks for reranking
    console.log("\n[3/5] Preparing chunks for reranking...");
    const chunks = queryResponse.matches.map(match => ({
      docId: match.metadata?.docId,
      text: match.metadata?.text || "",
      title: match.metadata?.title || "",
      authority: match.metadata?.authority || "",
      year: match.metadata?.year || "",
      docType: match.metadata?.docType || "",
      pineconeScore: match.score
    })).filter(c => c.docId && c.text);

    // Truncate chunks for reranker (max 800 chars)
    const chunksForRerank = chunks.map(c => 
      c.text.length > 800 ? c.text.substring(0, 800) + '...' : c.text
    );

    console.log(`✓ Prepared ${chunks.length} chunks`);

    // Step 4: Rerank with Jina
    console.log("\n[4/5] Reranking with Jina...");
    const t4 = Date.now();
    const reranked = await rerankDocs(queryText, chunksForRerank);
    console.log(`✓ Reranking done in ${Date.now() - t4}ms`);

    // Attach scores
    chunks.forEach((chunk, idx) => {
      chunk.rerankScore = reranked[idx]?.score || 0;
    });

    // Sort by rerank score
    chunks.sort((a, b) => b.rerankScore - a.rerankScore);

    console.log("\nTop 5 chunks:");
    chunks.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. [${c.rerankScore.toFixed(4)}] ${c.title}`);
    });

    // Step 5: Group by document
    console.log("\n[5/5] Grouping by document...");
    const docMap = new Map();
    
    chunks.forEach(chunk => {
      if (!docMap.has(chunk.docId)) {
        docMap.set(chunk.docId, {
          _id: chunk.docId,
          title: chunk.title,
          authority: chunk.authority,
          year: chunk.year,
          docType: chunk.docType,
          excerpt: chunk.text,
          rerankScore: chunk.rerankScore,
          pineconeScore: chunk.pineconeScore
        });
      }
    });

    let results = Array.from(docMap.values());
    results.sort((a, b) => b.rerankScore - a.rerankScore);

    console.log(`\nFound ${results.length} unique documents`);

    // Show top 3-5 based on score
    const topScore = results[0]?.rerankScore || 0;
    let numToShow = 3;
    
    if (topScore > 0.4) numToShow = 5;
    else if (topScore > 0.25) numToShow = 4;
    else if (topScore < 0.15) numToShow = 1;

    results = results.slice(0, numToShow);
    console.log(`Showing top ${numToShow} documents (top score: ${topScore.toFixed(4)})`);

    // Calculate percentages
    const totalScore = results.reduce((sum, d) => sum + d.rerankScore, 0);
    results.forEach(doc => {
      doc.score = doc.rerankScore / totalScore;
      doc.scorePercent = (doc.rerankScore / totalScore) * 100;
    });

    // Fetch file URLs from MongoDB
    const docIds = results.map(r => r._id);
    const dbDocs = await Document.find({ _id: { $in: docIds } }).lean();
    const dbMap = Object.fromEntries(dbDocs.map(d => [d._id.toString(), d]));

    results = results.map(doc => {
      const dbInfo = dbMap[doc._id];
      doc.fileUrl = dbInfo?.fileUrl || null;
      doc.fileName = dbInfo?.fileName || null;
      console.log(`  → ${doc.title.substring(0, 40)}... | ${doc.scorePercent.toFixed(1)}%`);
      return doc;
    });

    console.log(`\n⏱ Total time: ${Date.now() - startTime}ms`);

    // Save to history
    await new QueryHistory({
      query: queryText,
      results: results.map(d => d.title),
      timestamp: new Date()
    }).save();

    res.json({ documents: results });

  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});
