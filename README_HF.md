---
title: Jina Embedding Service
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# Jina Embedding Service

This is a Flask-based embedding service using Jina AI models for document embeddings and reranking.

## Features

- **Embeddings**: Generate 512-dimensional embeddings using `jinaai/jina-embeddings-v3`
- **Reranking**: Rerank documents by relevance using `jinaai/jina-reranker-v2-base-multilingual`

## API Endpoints

### GET /health
Health check endpoint

### POST /embed
Generate embeddings for text
```json
{
  "texts": ["text1", "text2"],
  "task": "retrieval.passage"
}
```

### POST /rerank
Rerank documents by query relevance
```json
{
  "query": "search query",
  "documents": ["doc1", "doc2", "doc3"]
}
```

## Models

- Embedding Model: jinaai/jina-embeddings-v3 (512 dimensions)
- Reranker Model: jinaai/jina-reranker-v2-base-multilingual
