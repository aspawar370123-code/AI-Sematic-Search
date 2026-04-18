import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    default: "system"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Admin", adminSchema);