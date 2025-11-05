// routes/users.js
const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const User     = require('../models/user');
const Task     = require('../models/Task');

// ---------- helpers ----------
function parseJSON(q) {
  if (q === undefined) return undefined;
  try { return JSON.parse(q); }
  catch {
    const e = new Error('Invalid JSON in query parameter');
    e.status = 400; throw e;
  }
}
const ok  = (m, d) => ({ message: m, data: d });
const err = (m)    => ({ message: m, data: null });

// ---------- GET /api/users  (where/sort/select/skip/limit/count; NO default limit) ----------
router.get('/', async (req, res) => {
  try {
    const where  = parseJSON(req.query.where)  || {};
    const sort   = parseJSON(req.query.sort)   || undefined;
    const select = parseJSON(req.query.select) || undefined;
    const skip   = req.query.skip  ? Number(req.query.skip)  : undefined;
    const limit  = req.query.limit ? Number(req.query.limit) : undefined; // no default
    const count  = req.query.count === 'true';

    if (count) {
      const n = await User.countDocuments(where);
      return res.status(200).json(ok('OK', n));          // data is NUMBER
    }

    let q = User.find(where);
    if (sort)   q = q.sort(sort);
    if (select) q = q.select(select);
    if (skip)   q = q.skip(skip);
    if (limit)  q = q.limit(limit);

    const data = await q.exec();
    res.status(200).json(ok('OK', data));                // data is ARRAY
  } catch (e) {
    res.status(e.status || 500).json(err(e.message || 'Server error'));
  }
});

// ---------- POST /api/users  (name/email required; email unique; optional pendingTasks backfill) ----------
router.post('/', async (req, res) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) return res.status(400).json(err('Validation error: name and email are required'));

    const user = await User.create({ name, email, pendingTasks });

    // backfill tasks referenced in pendingTasks
    if (pendingTasks.length) {
      const ids = pendingTasks.map(String);
      await Task.updateMany(
        { _id: { $in: ids } },
        { $set: { assignedUser: String(user._id), assignedUserName: user.name, completed: false } }
      );
    }

    res.status(201).json(ok('User created', user));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json(err('Validation error: email must be unique'));
    res.status(400).json(err('Validation error: check fields'));
  }
});

// ---------- GET /api/users/:id  (ONLY honor select) ----------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('User not found'));

    const select = parseJSON(req.query.select) || undefined; // only select is honored
    let q = User.findById(id);
    if (select) q = q.select(select);

    const doc = await q.exec();
    if (!doc) return res.status(404).json(err('User not found'));
    res.status(200).json(ok('OK', doc));
  } catch (e) {
    res.status(e.status || 500).json(err(e.message || 'Server error'));
  }
});

// ---------- PUT /api/users/:id  (full replace + two-way integrity) ----------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('User not found'));

    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) return res.status(400).json(err('Validation error: name and email are required'));

    const user = await User.findById(id);
    if (!user) return res.status(404).json(err('User not found'));

    // unassign all tasks previously pointing to this user
    await Task.updateMany(
      { assignedUser: id },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );

    // update user fields
    user.name = name;
    user.email = email;
    user.pendingTasks = pendingTasks.map(String);
    await user.save();

    // re-assign the new pendingTasks and force completed=false
    if (user.pendingTasks.length) {
      await Task.updateMany(
        { _id: { $in: user.pendingTasks } },
        { $set: { assignedUser: id, assignedUserName: name, completed: false } }
      );
    }

    res.status(200).json(ok('User updated', user));
  } catch (e) {
    if (e.code === 11000) return res.status(400).json(err('Validation error: email must be unique'));
    res.status(400).json(err('Validation error: check fields'));
  }
});

// ---------- DELETE /api/users/:id  (unassign their tasks, then delete) ----------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json(err('User not found'));

    const user = await User.findById(id);
    if (!user) return res.status(404).json(err('User not found'));

    await Task.updateMany(
      { assignedUser: id },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } }
    );
    await user.deleteOne();

    res.status(204).json(ok('Deleted', null));           // still return envelope
  } catch (e) {
    res.status(e.status || 500).json(err(e.message || 'Server error'));
  }
});

module.exports = router;
