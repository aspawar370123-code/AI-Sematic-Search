const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "policy_documents",
    resource_type: "raw", // Use 'raw' for PDF files
    public_id: (req, file) => {
      // Simple unique filename
      const timestamp = Date.now();
      return `document_${timestamp}`;
    }
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log("File filter check:");
    console.log("- mimetype:", file.mimetype);
    console.log("- originalname:", file.originalname);
    
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      console.log("✅ PDF file accepted");
      cb(null, true);
    } else {
      console.log("❌ File rejected - not PDF");
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

module.exports = upload;