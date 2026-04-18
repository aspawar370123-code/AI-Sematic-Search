import mongoose from "mongoose";

const officerSchema = new mongoose.Schema({
  name: String,
  designation: String,
  email: { type: String, unique: true },
  password: String,
  approved: { type: Boolean, default: false },
  approvedBy: String,
  approvedAt: Date,
  lastActiveAt: Date
}, { timestamps: true });

export default mongoose.model("Officer", officerSchema);