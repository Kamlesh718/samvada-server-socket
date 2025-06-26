import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: 86400 } },
});

export default mongoose.model("Message", messageSchema);
