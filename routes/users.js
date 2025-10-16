import express from "express";
import User from "../models/User.js";
import Task from "../models/Task.js";
import { runQuery, parseJSON } from "../utils/query.js";

const router = express.Router();

// GET /users
router.get("/", async (req, res) => {
  try {
    const result = await runQuery(User, req);
    return res.status(200).json({ message: "OK", data: result.data });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// POST /users
router.post("/", async (req, res) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email)
      return res.status(400).json({ message: "name and email are required", data: null });

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists)
      return res.status(400).json({ message: "email already exists", data: null });

    const user = await User.create({ name, email, pendingTasks });

    if (pendingTasks.length) {
      const tasks = await Task.find({ _id: { $in: pendingTasks } });
      await Promise.all(
        tasks.map(async (t) => {
          t.assignedUser = user._id;
          t.assignedUserName = user.name;
          await t.save();
        })
      );
      await user.save();
    }

    return res.status(201).json({ message: "Created", data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// GET /users/:id
router.get("/:id", async (req, res) => {
  try {
    const projection = parseJSON(req.query.select);
    const user = await User.findById(req.params.id, projection || undefined);
    if (!user) return res.status(404).json({ message: "User not found", data: null });
    return res.status(200).json({ message: "OK", data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// PUT /users/:id
router.put("/:id", async (req, res) => {
  try {
    const payload = { ...req.body };
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found", data: null });

    if (payload.email) {
      const dupe = await User.findOne({ email: String(payload.email).toLowerCase(), _id: { $ne: req.params.id } });
      if (dupe) return res.status(400).json({ message: "email already exists", data: null });
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.email !== undefined) user.email = payload.email;

    if (payload.pendingTasks) {
      const newSet = new Set(payload.pendingTasks.map(String));
      const oldSet = new Set(user.pendingTasks.map(String));

      const toAdd = [...newSet].filter((id) => !oldSet.has(id));
      const toRemove = [...oldSet].filter((id) => !newSet.has(id));

      await Promise.all(
        toAdd.map(async (id) => {
          const t = await Task.findById(id);
          if (t) {
            t.assignedUser = user._id;
            t.assignedUserName = user.name;
            await t.save();
          }
        })
      );

      await Promise.all(
        toRemove.map(async (id) => {
          const t = await Task.findById(id);
          if (t && String(t.assignedUser) === String(user._id)) {
            t.assignedUser = null;
            t.assignedUserName = "unassigned";
            await t.save();
          }
        })
      );

      user.pendingTasks = [...newSet];
    }

    await user.save();
    return res.status(200).json({ message: "OK", data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// DELETE /users/:id
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found", data: null });

    await Task.updateMany(
      { _id: { $in: user.pendingTasks } },
      { $set: { assignedUser: null, assignedUserName: "unassigned" } }
    );

    await user.deleteOne();
    return res.status(204).json({ message: "No Content", data: null });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

export default router;

