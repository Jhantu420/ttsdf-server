import mongoose from "mongoose";

const applySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String },
    center: { type: String, required: true },
    course: { type: String, required: true },
  },
  { timestamps: true }
);

const applyModel =
  mongoose.models.ApplyCourse || mongoose.model("ApplyCourse", applySchema);

export default applyModel; 
