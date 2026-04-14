const mongoose = require("mongoose");

const OfficerSchema = new mongoose.Schema({
  name: String,
  designation: String,
  email: { type: String, unique: true },
  password: String,
  approved: { type: Boolean, default: false }, // admin approval optional
  lastActiveAt: { type: Date, default: null}
}, { timestamps: true });

module.exports = mongoose.model("Officer", OfficerSchema);