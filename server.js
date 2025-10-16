import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import dotenv from 'dotenv';
import usersRouter from './routes/users.js';
import tasksRouter from './routes/tasks.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan('dev'));

// 统一返回 404
app.use((req, res, next) => {
  res.ok = (data) => res.status(200).json({ message: 'OK', data });
  next();
});

// 路由挂载：既支持 /api/* 也支持根路径，方便示例与脚本
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/users', usersRouter);
app.use('/tasks', tasksRouter);

// 错误兜底
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .json({ message: 'Server error', data: null });
});

const PORT = process.env.PORT || 3000;
const URI = process.env.MONGODB_URI;

mongoose
  .connect(URI, { dbName: new URL(URI).pathname.replace('/', '') || undefined })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
