// models/Course.js
import mongoose from "mongoose";

const CourseSchema = new mongoose.Schema(
  {
    course_name: {
      type: String,
      required: true,
    },
    course_full_name: {
      type: String,
      required: true,
    },
    course_content: {
      type: [String],
      default:[],
      required: true,
    },
    course_duration: {
      type: String,
      required: true,
    },
    image: { type: [String], default: [] },
    extra_facilities: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const courseModel =
  mongoose.models.Course || mongoose.model("Course", CourseSchema);
export default courseModel;
