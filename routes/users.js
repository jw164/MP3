// routes/users.js
import express from "express";
import User from "../models/User.js";
import Task from "../models/Task.js";
import { runQuery, parseJSON } from "../utils/query.js";

const router = express.Router();

/**
 * GET /api/users
 * Supports: where / sort / select / skip / limit / count
 */
router.get("/", async (req, res) => {
  try {
    const result = await runQuery(User, req);
    res.status(200).json({ message: "OK", data: result.data });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
});

/**
 * POST /api/users
 * Validates name/email; email unique; sync pendingTasks -> tasks' assignedUser/Name
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required", data: null });
    }
    const dupe = await User.findOne({ email: String(email).toLowerCase() });
    if (dupe) return res.status(400).json({ message: "email already exists", data: null });

    const user = await User.create({ name, email, pendingTasks });

    // two-way: assign listed tasks to this user
    if (pendingTasks.length) {
      const tasks = await Task.find({ _id: { $in: pendingTasks } });
      await Promise.all(
        tasks.map(async (t) => {
          t.assignedUser = String(user._id); // if your Task.assignedUser is ObjectId, use user._id
          t.assignedUserName = user.name;
          await t.save();
        })
      );
    }

    res.status(201).json({ message: "Created", data: user });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
});

/**
 * GET /api/users/:id
 * Supports ?select={...}
 */
router.get("/:id", async (req, res) => {
  try {
    const projection = parseJSON(req.query.select);
    const user = await User.findById(req.params.id, projection || undefined);
    if (!user) return res.status(404).json({ message: "User not found", data: null });
    res.status(200).json({ message: "OK", data: user });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
});

/**
 * PUT /api/users/:id
 * Replaces fields; keeps user<->task references consistent with pendingTasks
 */
router.put("/:id", async (req, res) => {
  try {
    const payload = { ...req.body };
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found", data: null });

    if (payload.email) {
      const other = await User.findOne({
        email: String(payload.email).toLowerCase(),
        _id: { $ne: req.params.id },
      });
      if (other) return res.status(400).json({ message: "email already exists", data: null });
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.email !== undefined) user.email = payload.email;

    if (payload.pendingTasks) {
      const newIds = new Set(payload.pendingTasks.map(String));
      const oldIds = new Set(user.pendingTasks.map(String));

      const toAdd = [...newIds].filter((id) => !oldIds.has(id));
      const toRemove = [...oldIds].filter((id) => !newIds.has(id));

      // assign tasks newly listed
      await Promise.all(
        toAdd.map(async (id) => {
          const t = await Task.findById(id);
          if (t) {
            t.assignedUser = String(user._id);
            t.assignedUserName = user.name;
            await t.save();
          }
        })
      );

      // unassign tasks removed from list (only if currently assigned to this user)
      await Promise.all(
        toRemove.map(async (id) => {
          const t = await Task.findById(id);
          if (t && String(t.assignedUser) === String(user._id)) {
            t.assignedUser = "";              // if your Task uses ObjectId|null, set to null
            t.assignedUserName = "unassigned";
            await t.save();
          }
        })
      );

      user.pendingTasks = [...newIds];
    }

    await user.save();
    res.status(200).json({ message: "OK", data: user });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
});

/**
 * DELETE /api/users/:id
 * Unassign all that user's pending tasks, then delete
 */
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found", data: null });

    await Task.updateMany(
      { _id: { $in: user.pendingTasks } },
      { $set: { assignedUser: "", assignedUserName: "unassigned" } } // if ObjectId|null: assignedUser: null
    );

    await user.deleteOne();
    res.status(204).json({ message: "No Content", data: null });
  } catch (err) {
    res.status(400).json({ message: err.message, data: null });
  }
});

export default router;


