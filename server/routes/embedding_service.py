from sentence_transformers import SentenceTransformer, CrossEncoder
from flask import Flask, request, jsonify
import torch
import os

app = Flask(__name__)

# Detect GPU availability
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"🚀 Using device: {device}")
if device == 'cuda':
    print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   CUDA Version: {torch.version.cuda}")
else:
    print("   ⚠️  GPU not available, using CPU (will be slow)")
    # Set optimal CPU threads for Ryzen 7
    torch.set_num_threads(8)
    os.environ['OMP_NUM_THREADS'] = '8'
    os.environ['MKL_NUM_THREADS'] = '8'

print("Loading models... (this takes ~30 seconds on first run)")

# 1. Load Models with automatic GPU/CPU selection
embed_model = SentenceTransformer(
    'jinaai/jina-embeddings-v3', 
    trust_remote_code=True,
    device=device
)
embed_model.eval()  # Set to evaluation mode for faster inference

reranker = CrossEncoder(
    'jinaai/jina-reranker-v2-base-multilingual', 
    trust_remote_code=True,
    device=device,
    max_length=512  # Limit input length for speed
)

print("✓ Models loaded and ready!")
print(f"✓ Embed model on: {embed_model.device}")

# 🔹 HEALTH CHECK
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "device": device,
        "models": {
            "embedding": "jinaai/jina-embeddings-v3",
            "reranker": "jinaai/jina-reranker-v2-base-multilingual"
        }
    })

# 🔹 BATCH EMBEDDINGS
@app.route('/embed', methods=['POST'])
def embed():
    data = request.json
    texts = data.get("texts", [])
    task = data.get("task", "retrieval.passage")

    # Optimized batch size based on device
    batch_size = 32 if device == 'cuda' else 8

    with torch.no_grad():  # Disable gradient computation for speed
        embeddings = embed_model.encode(
            texts,
            task=task,
            batch_size=batch_size,
            truncate_dim=512,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        ).tolist()

    return jsonify({"embeddings": embeddings})

# 🔹 BATCH RERANKING
@app.route('/rerank', methods=['POST'])
def rerank():
    try:
        data = request.get_json(force=True)
        query = data.get("query")
        documents = data.get("documents", [])

        if not query or not documents:
            return jsonify({"results": []})

        # Create query-document pairs for the reranker
        pairs = [[query, doc] for doc in documents]

        # Optimized batch size based on device
        batch_size = 32 if device == 'cuda' else 8

        # Optimized inference
        with torch.no_grad():
            scores = reranker.predict(
                pairs, 
                batch_size=batch_size,
                show_progress_bar=False
            )

        # Return results with original documents and scores
        return jsonify({
            "results": [
                {"document": doc, "score": float(score)}
                for doc, score in zip(documents, scores)
            ]
        })
    except Exception as e:
        print(f"!!! RERANK ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Threaded=True allows Flask to handle concurrent Node.js calls
    # host='0.0.0.0' allows external connections in Docker
    # Port 7860 for Hugging Face Spaces, fallback to 5001 for local
    port = int(os.environ.get('PORT', 7860))
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True, use_reloader=False)