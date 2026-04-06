const mongoose = require("mongoose");
const QueryHistorySchema = new mongoose.Schema({
  queryText: String,
  topDocumentTitle: String,
  results: Array, // Store the results array so we don't have to re-search
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model("QueryHistory", QueryHistorySchema);