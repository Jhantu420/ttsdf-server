import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
  },
  { timestamps: true }
);

export const Activity = mongoose.model("Activity", activitySchema);
