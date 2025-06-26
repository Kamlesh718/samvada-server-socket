import { Server } from "socket.io";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import Message from "./models/Message.js";

configDotenv();
const MONGODB_URI = process.env.MONGODB_URI;
const onlineUsers = new Map();
const offlineTimeouts = new Map();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.0.108:3000"],
    methods: ["GET", "POST"],
  },
});

mongoose
  .connect(MONGODB_URI, { dbName: "samvada" })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB error: ", err));

// mongoose.connection.on("connected", () => {
//   console.log("✅ Connected to DB:", mongoose.connection.name); // should print "samvada"
// });

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);

  socket.on("user_online", (userId) => {
    if (!userId) return;

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId)?.add(socket.id);

    // Send all online users to the newly connected client
    socket.emit(
      "initial_user_statuses",
      Object.fromEntries(
        [...onlineUsers.entries()].map(([id]) => [id, "online"])
      )
    );

    // Notify others that this user is online
    socket.broadcast.emit("update_user_status", { userId, status: "online" });

    console.log(`✅ ${userId} connected with socket ${socket.id}`);
  });

  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room ${room}`);
  });

  socket.on("send_message", async (msg) => {
    try {
      const savedMsg = await Message.create({
        senderId: new mongoose.Types.ObjectId(msg.senderId),
        receiverId: new mongoose.Types.ObjectId(msg.receiverId),
        text: msg.text,
      });

      // ✅ Fix: define room before using
      const room = [msg.senderId, msg.receiverId].sort().join("_");

      io.to(room).emit("receive_message", {
        ...savedMsg.toObject(),
        senderId: savedMsg.senderId.toString(),
        receiverId: savedMsg.receiverId.toString(),
      });

      // socket.to(room).emit("receive_message", {
      //   ...savedMsg.toObject(),
      //   senderId: savedMsg.senderId.toString(),
      //   receiverId: savedMsg.receiverId.toString(),
      // });
    } catch (err) {
      console.error("❌ Error saving msg:", err);
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, sockets] of onlineUsers.entries()) {
      sockets.delete(socket.id);

      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("update_user_status", { userId, status: "offline" });
        console.log(`🔴 ${userId} is now offline`);
      }
    }
  });
});

server.listen(3001, () => {
  console.log("Socket.IO server running on port 3001");
});
