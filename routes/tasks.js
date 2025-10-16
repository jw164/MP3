import express from "express";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { runQuery, parseJSON } from "../utils/query.js";

const router = express.Router();

// GET /tasks
router.get("/", async (req, res) => {
  try {
    const result = await runQuery(Task, req);
    return res.status(200).json({ message: "OK", data: result.data });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// POST /tasks
router.post("/", async (req, res) => {
  try {
    const { name, deadline, description = "", completed = false, assignedUser } = req.body || {};
    if (!name || !deadline)
      return res.status(400).json({ message: "name and deadline are required", data: null });

    const task = await Task.create({
      name,
      description,
      deadline,
      completed,
      assignedUser: assignedUser || null,
      assignedUserName: "unassigned"
    });

    if (task.assignedUser) {
      const user = await User.findById(task.assignedUser);
      if (!user) return res.status(400).json({ message: "assignedUser not found", data: null });
      task.assignedUserName = user.name;
      await task.save();
      if (!task.completed) {
        await User.updateOne({ _id: user._id }, { $addToSet: { pendingTasks: task._id } });
      }
    }

    return res.status(201).json({ message: "Created", data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// GET /tasks/:id
router.get("/:id", async (req, res) => {
  try {
    const projection = parseJSON(req.query.select);
    const task = await Task.findById(req.params.id, projection || undefined);
    if (!task) return res.status(404).json({ message: "Task not found", data: null });
    return res.status(200).json({ message: "OK", data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// PUT /tasks/:id
router.put("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found", data: null });

    const payload = { ...req.body };
    const oldAssigned = task.assignedUser ? String(task.assignedUser) : null;

    ["name", "description", "deadline", "completed"].forEach((k) => {
      if (payload[k] !== undefined) task[k] = payload[k];
    });

    if (payload.assignedUser !== undefined) {
      if (payload.assignedUser) {
        const newUser = await User.findById(payload.assignedUser);
        if (!newUser) return res.status(400).json({ message: "assignedUser not found", data: null });
        task.assignedUser = newUser._id;
        task.assignedUserName = newUser.name;
      } else {
        task.assignedUser = null;
        task.assignedUserName = "unassigned";
      }
    }

    await task.save();

    if (oldAssigned && (!task.assignedUser || String(task.assignedUser) !== oldAssigned)) {
      await User.updateOne({ _id: oldAssigned }, { $pull: { pendingTasks: task._id } });
    }

    if (task.assignedUser) {
      if (task.completed) {
        await User.updateOne({ _id: task.assignedUser }, { $pull: { pendingTasks: task._id } });
      } else {
        await User.updateOne({ _id: task.assignedUser }, { $addToSet: { pendingTasks: task._id } });
      }
    }

    return res.status(200).json({ message: "OK", data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// DELETE /tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found", data: null });

    if (task.assignedUser) {
      await User.updateOne({ _id: task.assignedUser }, { $pull: { pendingTasks: task._id } });
    }

    await task.deleteOne();
    return res.status(204).json({ message: "No Content", data: null });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

export default router;
