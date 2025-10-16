// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { MongoMemoryServer } from "mongodb-memory-server";

import userRoutes from "./routes/users.js";
import taskRoutes from "./routes/tasks.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "MP3 API is running successfully 🚀" });
});

// MongoDB connection
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log("Connected to MongoDB Atlas");
    } else {
      console.log("No MONGODB_URI found. Using in-memory MongoDB.");
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log("Connected to MongoDB (in-memory)");
    }
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }
};

const PORT = process.env.PORT || 3000;

// Start the server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
});



}

start();
