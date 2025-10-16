tee server.js >/dev/null <<'EOF'
// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { MongoMemoryServer } from "mongodb-memory-server";

import usersRouter from "./routes/users.js";
import tasksRouter from "./routes/tasks.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// routes
app.use("/api/users", usersRouter);
app.use("/api/tasks", tasksRouter);

// health
app.get("/", (req, res) => {
  res.json({ message: "MP3 API is running" });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      await mongoose.connect(uri);
      console.log("[MongoDB] Connected to external URI");
    } else {
      console.log("[MongoDB] No MONGODB_URI, using in-memory DB");
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri("mp3"));
      console.log("[MongoDB] In-memory DB ready");
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
EOF

