import mongoose from "mongoose";

const SendMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ph: { type: String, required: true },
    email: { type: String },
    msg: { type: String, required:true },
  },
  {
    timestamps: true,
  }
);
const SendMessageModel =
  mongoose.models.send_msg || mongoose.model("send_msg", SendMessageSchema);

export default SendMessageModel;
