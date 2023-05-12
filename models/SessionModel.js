const mongoose = require('mongoose');

const SessionSchema = mongoose.Schema({
  adminName: String,
  userNames: [String],
  topics: [
      {
      title: String,
      averageScore: Number,
      }
  ]
});

module.exports = mongoose.model("Session", SessionSchema);