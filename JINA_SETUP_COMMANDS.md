# Jina Embedding Service Setup Commands

## Step 1: Activate the Virtual Environment
```powershell
.\jina_env\Scripts\Activate.ps1
```

## Step 2: Upgrade pip
```powershell
python -m pip install --upgrade pip
```

## Step 3: Install Required Packages
```powershell
pip install sentence-transformers flask torch einops
```

## Step 4: Start the Embedding Service
```powershell
python server\routes\embedding_service.py
```

---

## Alternative: All Commands in One Go

Copy and paste this entire block:

```powershell
.\jina_env\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install sentence-transformers flask torch einops
python server\routes\embedding_service.py
```

---

## What Gets Installed

- **sentence-transformers** (5.4.1) - For Jina embeddings and reranking
- **flask** (3.1.3) - Web server for the API
- **torch** (2.11.0) - PyTorch for model inference
- **einops** - Required dependency for Jina models
- Plus all their dependencies (transformers, numpy, scipy, etc.)

---

## Expected Output

When you run the embedding service, you should see:

```
🚀 Using device: cpu
   ⚠️  GPU not available, using CPU (will be slow)
Loading models... (this takes ~30 seconds on first run)
✓ Models loaded and ready!
✓ Embed model on: cpu
 * Serving Flask app 'embedding_service'
 * Running on http://127.0.0.1:5001
```

---

## Troubleshooting

### If you get "No Python" error:
Always use the full path:
```powershell
.\jina_env\Scripts\python.exe server\routes\embedding_service.py
```

### If models fail to load:
The Jina models require `trust_remote_code=True` and will download on first run (~2GB total).

### If you need to recreate the environment:
```powershell
Remove-Item -Recurse -Force jina_env
python -m venv jina_env
```

---

## API Endpoints

Once running, the service provides:

### POST http://127.0.0.1:5001/embed
Generate 512-dimensional embeddings
```json
{
  "texts": ["text1", "text2"],
  "task": "retrieval.passage"
}
```

### POST http://127.0.0.1:5001/rerank
Rerank documents by relevance
```json
{
  "query": "search query",
  "documents": ["doc1", "doc2", "doc3"]
}
```
