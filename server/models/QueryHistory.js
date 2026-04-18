import mongoose from "mongoose";

const QueryHistorySchema = new mongoose.Schema({
  queryText: String,
  topDocumentTitle: String,
  results: Array, // Store the results array so we don't have to re-search
  officerEmail: String, // Track which officer made the query
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("QueryHistory", QueryHistorySchema);