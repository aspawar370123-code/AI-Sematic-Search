import mongoose from "mongoose";

const officerSchema = new mongoose.Schema({
  name: String,
  designation: String,
  email: { type: String, unique: true },
  password: String,
  lastActiveAt: Date
}, { timestamps: true });

export default mongoose.model("Officer", officerSchema);