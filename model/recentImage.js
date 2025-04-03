import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    images: [String], // ✅ Ensure this field matches what you're trying to save
  },
  { timestamps: true }
);

export default mongoose.model("Image", ImageSchema);
