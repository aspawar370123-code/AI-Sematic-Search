# Search System Improvements - Chunk-Based Reranking

## Problem
The previous approach was:
1. Grouping chunks by document BEFORE reranking
2. Combining top 3 chunks per document
3. Reranking combined documents
4. Using 60% relevance threshold (too strict)
5. Often showing wrong documents or filtering out correct ones

**Example Issue:** Query "salient features of NEP 2020 in annual report" showed NEP 2020 document instead of Annual Report (which had the actual answer).

## Solution - Direct Chunk Reranking

### New Approach:
1. **Retrieve top 50 chunks** from Pinecone (hybrid search: 50% semantic + 50% keyword)
2. **Rerank ALL 50 chunks individually** with Jina reranker
3. **Group by document AFTER reranking** - select best chunk per document
4. **Use best chunk as excerpt** - shows the most relevant section
5. **Apply lenient filtering** (35% threshold instead of 60%)

### Key Changes:

#### 1. No Pre-Grouping
```javascript
// OLD: Grouped chunks by document first, combined top 3
const chunksByDoc = new Map();
// ... grouping logic

// NEW: Send all 50 chunks directly to reranker
const allChunksWithMetadata = queryResponse.matches.map(match => ({
  docId: match.metadata?.docId,
  text: match.metadata?.text,
  // ... metadata
}));
```

#### 2. Individual Chunk Reranking
```javascript
// Rerank each chunk separately with metadata context
const chunksForRerank = allChunksWithMetadata.map(chunk => {
  return `Document: ${chunk.title}\nType: ${chunk.docType}\n\n${chunk.text}`;
});

const rerankedChunks = await rerankDocs(queryText, chunksForRerank);
```

#### 3. Best Chunk Selection
```javascript
// Group by document AFTER reranking
const docChunksMap = new Map();
allChunksWithMetadata.forEach(chunk => {
  docChunksMap.get(chunk.docId).push(chunk);
});

// Use highest-scoring chunk as document representative
const bestChunk = chunks.sort((a, b) => b.rerankScore - a.rerankScore)[0];
```

#### 4. More Lenient Thresholds
```javascript
// OLD: 60% relevance threshold
filtered = filtered.filter(doc => doc.scorePercent >= 60);

// NEW: 35% relevance threshold
const RELEVANCE_THRESHOLD = 35;
filtered = filtered.filter(doc => doc.scorePercent >= RELEVANCE_THRESHOLD);

// If no docs meet threshold, show top 2 instead of just 1
```

#### 5. Better Keyword Matching
```javascript
// OLD: Required 50% of top score OR keywords
const isStrongRelative = doc.rerankScore >= (topScore * 0.5);

// NEW: Required only 30% of top score OR keywords
const isModerateRelative = doc.rerankScore >= (topScore * 0.3);
```

## Benefits

1. **More Accurate Results** - Reranker evaluates each chunk independently, finding the truly relevant ones
2. **Better Excerpts** - Shows the actual relevant chunk, not a combined/truncated version
3. **Multiple Relevant Docs** - Lower threshold allows showing 2-3 relevant documents instead of forcing 1
4. **Faster** - Reranking 50 chunks once is faster than reranking documents + chunks separately
5. **Keyword Safety Net** - Documents with query keywords aren't filtered out even with moderate scores

## Expected Behavior

For query: "What are salient features of NEP 2020 listed in Ministry of Education's annual report?"

**Before:** Showed only NEP 2020 document (wrong - doesn't contain the answer)

**After:** Should show:
1. Annual Report (contains the actual salient features) - 60-70%
2. NEP 2020 document (related but not the answer) - 30-40%

Both documents are relevant, but the Annual Report should rank higher because it contains the specific information requested.
