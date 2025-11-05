// routes/tasks.js
const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Task     = require('../models/Task');
const User     = require('../models/user');

function parseJSON(q) {
  if (q === undefined) return undefined;
  try { return JSON.parse(q); }
  catch { const e = new Error('Invalid JSON in query parameter'); e.status = 400; throw e; }
}
const ok  = (m, d) => ({ message: m, data: d });
const err = (m)    => ({ message: m, data: null });

// GET /api/tasks  — supports where/sort/select/skip/limit/count (default limit=100)
router.get('/', async (req, res) => {
  try {
    const where  = parseJSON(req.query.where)  || {};
    const sort   = parseJSON(req.query.sort)   || undefined;
    const select = parseJSON(req.query.select) || undefined;
    const skip   = req.query.skip   ? Number(req.query.skip)   : undefined;
    const limit  = req.query.limit  ? Number(req.query.limit)  : 100;
    const count  = req.query.count === 'true';

    if (count) {
      const n = await Task.countDocuments(where);
      return res.status(200).json(ok('OK', n));
    }

    let q = Task.find(where);
    if (sort)   q = q.sort(sort);
    if (select) q = q.select(select);
    if (skip)   q = q.skip(skip);
    if (limit)  q = q.limit(limit);

    const data = await q.exec();
    res.status(200).json(ok('OK', data));
  } catch (e) {
    res.status(e.status || 500).json(err(e.message || 'Server error'));
  }
});

// POST /api/tasks  — name/deadline required; add to user.pendingTasks if assigned & not completed
router.post('/', async (req, res) => {
  try {
    const {
      name, deadline, description,
      completed = false, assignedUser = "", assignedUserName = "unassigned"
    } = req.body || {};
    if (!name || !deadline) return res.status(400).json(err('Validation error: name and deadline are required'));

    // If assignedUser is provided, validate it exists and sync assignedUserName
    let finalAssignedUser = assignedUser;
    let finalAssignedUserName = assignedUserName;
    if (assignedUser) {
      const user = await User.findById(assignedUser);
      if (!user) return res.status(400).json(err('Validation error: assignedUser does not exist'));
      finalAssignedUserName = user.name; // Sync from User document
    }

    const task = await Task.create({ 
      name, deadline, description, completed, 
      assignedUser: finalAssignedUser, 
      assignedUserName: finalAssignedUserName 
    });

    if (finalAssignedUser && !completed) {
      await User.findByIdAndUpdate(finalAssignedUser, { $addToSet: { pendingTasks: String(task._id) } });
    }
    res.status(201).json(ok('Task created', task));
  } catch (e) {
    res.status(400).json(err('Validation error: check fields'));
  }
});

// GET /api/tasks/:id  — only `select` honored
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('Task not found'));

    const select = parseJSON(req.query.select) || undefined;
    let q = Task.findById(id);
    if (select) q = q.select(select);

    const doc = await q.exec();
    if (!doc) return res.status(404).json(err('Task not found'));
    res.status(200).json(ok('OK', doc));
  } catch (e) {
    res.status(e.status || 500).json(err(e.message || 'Server error'));
  }
});

// PUT /api/tasks/:id  — full replace + two-way sync with users
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('Task not found'));

    const {
      name, deadline, description = "",
      completed = false, assignedUser = "", assignedUserName = "unassigned"
    } = req.body || {};
    if (!name || !deadline) return res.status(400).json(err('Validation error: name and deadline are required'));

    const task = await Task.findById(id);
    if (!task) return res.status(404).json(err('Task not found'));

    // If assignedUser is provided, validate it exists and sync assignedUserName
    let finalAssignedUser = assignedUser;
    let finalAssignedUserName = assignedUserName;
    if (assignedUser) {
      const user = await User.findById(assignedUser);
      if (!user) return res.status(400).json(err('Validation error: assignedUser does not exist'));
      finalAssignedUserName = user.name; // Sync from User document
    }

    const prevAssigned = task.assignedUser;

    // Overwrite fields
    task.name = name;
    task.deadline = deadline;
    task.description = description;
    task.completed = completed;
    task.assignedUser = finalAssignedUser;
    task.assignedUserName = finalAssignedUserName;
    await task.save();

    // Remove from previous user's pendingTasks
    if (prevAssigned) {
      await User.findByIdAndUpdate(prevAssigned, { $pull: { pendingTasks: String(task._id) } });
    }
    // Add to new user's pendingTasks if applicable
    if (finalAssignedUser && !completed) {
      await User.findByIdAndUpdate(finalAssignedUser, { $addToSet: { pendingTasks: String(task._id) } });
    }
    // If completed, ensure no user keeps it in pendingTasks
    if (completed) {
      await User.updateMany({}, { $pull: { pendingTasks: String(task._id) } });
    }

    res.status(200).json(ok('Task updated', task));
  } catch (e) {
    res.status(400).json(err('Validation error: check fields'));
  }
});

// DELETE /api/tasks/:id  — remove from pendingTasks then delete
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('Task not found'));

    const task = await Task.findById(id);
    if (!task) return res.status(404).json(err('Task not found'));

    if (task.assignedUser) {
      await User.findByIdAndUpdate(task.assignedUser, { $pull: { pendingTasks: String(task._id) } });
    }
    await task.deleteOne();
    res.status(204).json(ok('Deleted', null));
  } catch {
    res.status(500).json(err('Server error'));
  }
});

module.exports = router;
