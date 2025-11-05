// models/Task.js
const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  deadline: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  assignedUser: { type: String, default: "" },
  assignedUserName: { type: String, default: "unassigned" },
}, { timestamps: { createdAt: 'dateCreated', updatedAt: false } });

module.exports = mongoose.model('Task', TaskSchema);
