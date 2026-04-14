import cloudinary from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

const cloudinaryV2 = cloudinary.v2;

// Configure cloudinary with environment variables
cloudinaryV2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Test cloudinary connection
cloudinaryV2.api.ping()
  .then(() => console.log("Cloudinary connected successfully"))
  .catch(err => console.error("Cloudinary connection failed:", err));

export default cloudinaryV2;