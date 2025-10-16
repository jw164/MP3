import express from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { runQuery, parseJSON } from '../utils/query.js';

const router = express.Router();

// GET /tasks
router.get('/', async (req, res) => {
  try {
    const result = await runQuery(Task, req);
    return res.status(200).json({ message: 'OK', data: result.data });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// POST /tasks
router.post('/', async (req, res) => {
  try {
    const { name, deadline, description = '', completed = false, assignedUser, assignedUserName } = req.body || {};
    if (!name || !deadline)
      return res
        .status(400)
        .json({ message: 'name and deadline are required', data: null });

    const task = await Task.create({
      name,
      description,
      deadline,
      completed,
      assignedUser: assignedUser || null,
      assignedUserName:
        assignedUser && assignedUserName ? assignedUserName : (assignedUser ? '' : 'unassigned')
    });

    // 若指派给用户，维护双向引用（仅把“未完成”的加入 pending）
    if (task.assignedUser) {
      const user = await User.findById(task.assignedUser);
      if (!user)
        return res.status(400).json({ message: 'assignedUser not found', data: null });

      task.assignedUserName = user.name;
      await task.save();

      if (!task.completed && !user.pendingTasks.includes(task._id)) {
        user.pendingTasks.push(task._id);
        await user.save();
      }
    } else {
      task.assignedUserName = 'unassigned';
      await task.save();
    }

    return res.status(201).json({ message: 'Created', data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// GET /tasks/:id   （支持 select）
router.get('/:id', async (req, res) => {
  try {
    const projection = parseJSON(req.query.select);
    const task = await Task.findById(req.params.id, projection || undefined);
    if (!task)
      return res.status(404).json({ message: 'Task not found', data: null });
    return res.status(200).json({ message: 'OK', data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// PUT /tasks/:id   （保证双向引用一致）
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found', data: null });

    const payload = { ...req.body };

    // 基本验证
    if (payload.name === '') return res.status(400).json({ message: 'name must be reasonable', data: null });
    if (payload.deadline === '') return res.status(400).json({ message: 'deadline must be reasonable', data: null });

    // 旧的指派信息
    const oldAssignedUser = task.assignedUser ? String(task.assignedUser) : null;

    // 更新普通字段
    ['name', 'description', 'deadline', 'completed'].forEach(k => {
      if (payload[k] !== undefined) task[k] = payload[k];
    });

    // 处理 assignedUser/assignedUserName
    if (payload.assignedUser !== undefined) {
      if (payload.assignedUser) {
        const newUser = await User.findById(payload.assignedUser);
        if (!newUser)
          return res.status(400).json({ message: 'assignedUser not found', data: null });
        task.assignedUser = newUser._id;
        task.assignedUserName = newUser.name;
      } else {
        task.assignedUser = null;
        task.assignedUserName = 'unassigned';
      }
    } else if (payload.assignedUserName !== undefined && task.assignedUser) {
      // 如果只改了名字且仍指向用户，则强制与用户保持一致
      const u = await User.findById(task.assignedUser);
      task.assignedUserName = u ? u.name : 'unassigned';
    }

    // 写回任务
    await task.save();

    // ——维护用户 pendingTasks——
    // 从旧用户移除
    if (oldAssignedUser && (!task.assignedUser || String(task.assignedUser) !== oldAssignedUser)) {
      await User.updateOne(
        { _id: oldAssignedUser },
        { $pull: { pendingTasks: task._id } }
      );
    }
    // 给新用户添加/移除（根据 completed）
    if (task.assignedUser) {
      if (task.completed) {
        await User.updateOne(
          { _id: task.assignedUser },
          { $pull: { pendingTasks: task._id } }
        );
      } else {
        await User.updateOne(
          { _id: task.assignedUser },
          { $addToSet: { pendingTasks: task._id } }
        );
      }
    }

    return res.status(200).json({ message: 'OK', data: task });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// DELETE /tasks/:id  （需要把该任务从 assignedUser.pendingTasks 移除）
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task)
      return res.status(404).json({ message: 'Task not found', data: null });

    if (task.assignedUser) {
      await User.updateOne(
        { _id: task.assignedUser },
        { $pull: { pendingTasks: task._id } }
      );
    }

    await task.deleteOne();
    return res.status(204).json({ message: 'No Content', data: null });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

export default router;
