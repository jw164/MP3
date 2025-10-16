import express from 'express';
import User from '../models/User.js';
import Task from '../models/Task.js';
import { runQuery, parseJSON } from '../utils/query.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await runQuery(User, req);
    if (result.type === 'count')
      return res.status(200).json({ message: 'OK', data: result.data });
    return res.status(200).json({ message: 'OK', data: result.data });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

// POST /users
router.post('/', async (req, res) => {
  try {
    const { name, email, pendingTasks = [] } = req.body || {};
    if (!name || !email)
      return res
        .status(400)
        .json({ message: 'name and email are required', data: null });

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists)
      return res
        .status(400)
        .json({ message: 'email already exists', data: null });

    const user = await User.create({ name, email, pendingTasks });

    if (pendingTasks.length) {
      const tasks = await Task.find({ _id: { $in: pendingTasks } });
      await Promise.all(
        tasks.map(t => {
          t.assignedUser = user._id;
          t.assignedUserName = user.name;
          if (!t.completed && !user.pendingTasks.includes(t._id)) {
            user.pendingTasks.push(t._id);
          }
          return t.save();
        })
      );
      await user.save();
    }

    return res.status(201).json({ message: 'Created', data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const projection = parseJSON(req.query.select);
    const user = await User.findById(req.params.id, projection || undefined);
    if (!user)
      return res.status(404).json({ message: 'User not found', data: null });
    return res.status(200).json({ message: 'OK', data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.email) {
      const dupe = await User.findOne({
        email: String(payload.email).toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (dupe)
        return res
          .status(400)
          .json({ message: 'email already exists', data: null });
    }

    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ message: 'User not found', data: null });

    // 验证 name/email 至少存在其一（更新成空会被视为不合理）
    if (payload.name === '') return res.status(400).json({ message: 'name must be reasonable', data: null });
    if (payload.email === '') return res.status(400).json({ message: 'email must be reasonable', data: null });

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.email !== undefined) user.email = payload.email;

    if (payload.pendingTasks) {
      const newSet = new Set(payload.pendingTasks.map(String));
      const oldSet = new Set(user.pendingTasks.map(String));

    
      const toAdd = [...newSet].filter(id => !oldSet.has(id));
  
      const toRemove = [...oldSet].filter(id => !newSet.has(id));

      await Promise.all(
        toAdd.map(async id => {
          const t = await Task.findById(id);
          if (t) {
            t.assignedUser = user._id;
            t.assignedUserName = user.name;
            return t.save();
          }
        })
      );
      await Promise.all(
        toRemove.map(async id => {
          const t = await Task.findById(id);
          if (t && String(t.assignedUser) === String(user._id)) {
            t.assignedUser = null;
            t.assignedUserName = 'unassigned';
            return t.save();
          }
        })
      );

      user.pendingTasks = [...newSet];
    }

    await user.save();
    return res.status(200).json({ message: 'OK', data: user });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json({ message: 'User not found', data: null });

    await Task.updateMany(
      { _id: { $in: user.pendingTasks } },
      { $set: { assignedUser: null, assignedUserName: 'unassigned' } }
    );

    await user.deleteOne();
    return res.status(204).json({ message: 'No Content', data: null });
  } catch (e) {
    return res.status(400).json({ message: e.message, data: null });
  }
});

export default router;
