HUGGING FACE SPACES DEPLOYMENT GUIDE
=====================================

STEP 1: Create Space on Hugging Face
-------------------------------------
1. Go to https://huggingface.co/spaces
2. Click "Create new Space"
3. Fill in:
   - Owner: Your username
   - Space name: AI-DOC-SYSTEM
   - License: MIT
   - Select SDK: Docker
   - Space hardware: CPU Upgrade (recommended) or T4 Small (best)
   - Visibility: Public or Private

STEP 2: Set Environment Variables
----------------------------------
In your Space settings, add these secrets:

MONGODB_URI=your_mongodb_connection_string
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_pinecone_index_name
GROQ_API_KEY=your_groq_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
VITE_API_URL=https://your-space-name.hf.space
PORT=5000

STEP 3: Push Code to Space
---------------------------
Option A: Using Git (Recommended)

git clone https://huggingface.co/spaces/YOUR_USERNAME/AI-DOC-SYSTEM
cd AI-DOC-SYSTEM
# Copy all your files here
git add .
git commit -m "Initial deployment"
git push

Option B: Upload via Web Interface

1. Go to your Space page
2. Click "Files" tab
3. Upload all files (Dockerfile, requirements.txt, package.json, etc.)

STEP 4: Wait for Build
-----------------------
- First build takes 10-15 minutes (downloading models)
- Check "Logs" tab for progress
- Look for: "✓ Models loaded and ready!"

STEP 5: Access Your App
------------------------
Your app will be available at:
https://huggingface.co/spaces/YOUR_USERNAME/AI-DOC-SYSTEM

IMPORTANT NOTES:
----------------
1. Embedding service runs on internal port 5001
2. Node.js backend runs on internal port 5000
3. Frontend runs on port 7860 (Hugging Face default)
4. Models download automatically on first run (~2GB)
5. Subsequent restarts are faster (models cached)

HARDWARE RECOMMENDATIONS:
-------------------------
- CPU Basic (Free): Works but slow (10-15s per search)
- CPU Upgrade ($0.03/hr): Good performance (3-5s per search)
- T4 Small GPU ($0.60/hr): Best performance (<1s per search)

TROUBLESHOOTING:
----------------
If build fails:
1. Check Logs tab for errors
2. Verify all environment variables are set
3. Ensure MongoDB/Pinecone are accessible from Hugging Face IPs
4. Check if models downloaded successfully

If app doesn't respond:
1. Wait 30 seconds after "Running" status
2. Check if all 3 services started (embedding, backend, frontend)
3. Look for "Listening on port" messages in logs
