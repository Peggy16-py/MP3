// Load required packages
// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  pendingTasks: { type: [String], default: [] },  // store task _id strings
}, { timestamps: { createdAt: 'dateCreated', updatedAt: false } });

module.exports = mongoose.model('User', UserSchema);
