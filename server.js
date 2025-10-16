// server.js
import express from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import usersRouter from "./routes/users.js";
import tasksRouter from "./routes/tasks.js";

let MongoMemoryServer;
try {
  ({ MongoMemoryServer } = await import("mongodb-memory-server"));
} catch {
  // skip if not installed
}

dotenv.config();

const app = express();
app.use(express.json());
app.use(morgan("dev"));

// Static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Unified response helper
app.use((req, res, next) => {
  res.ok = (data) => res.status(200).json({ message: "OK", data });
  next();
});

// Routes
app.use("/api/users", usersRouter);
app.use("/api/tasks", tasksRouter);
app.use("/users", usersRouter);
app.use("/tasks", tasksRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error", data: null });
});

const PORT = process.env.PORT || 3000;

// MongoDB connection (with in-memory fallback)
async function start() {
  try {
    let uri = process.env.MONGODB_URI;

    if (!uri) {
      if (!MongoMemoryServer) {
        console.error(
          "mongodb-memory-server not installed. Run: npm install mongodb-memory-server"
        );
        process.exit(1);
      }
      const mem = await MongoMemoryServer.create();
      uri = mem.getUri("mp3");
      console.log("[MongoDB] Using in-memory database:", uri);
    } else {
      console.log("[MongoDB] Using external URI from .env");
    }

    await mongoose.connect(uri);
    app.listen(PORT, () =>
      console.log(`✅ API running at http://localhost:${PORT}`)
    );
  } catch (e) {
    console.error("❌ Database connection failed:", e);
    process.exit(1);
  }
}

start();

}

start();
