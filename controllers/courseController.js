import { uploadToCloudinary } from "../helper/CloudinaryUpload.js";
import adminModel from "../model/adminModel.js";
import Branch from "../model/branch.js";
import courseModel from "../model/course.js";
import Image from "../model/recentImage.js";
import crypto from "crypto";

export const addCourse = async (req, res) => {
  try {
    const {
      course_name,
      course_content,
      course_duration,
      course_full_name,
      extra_facilities,
    } = req.body;

    if (
      !course_name ||
      !course_full_name ||
      !course_content ||
      !course_duration ||
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message: "All required fields and at least one image must be provided.",
      });
    }

    // ✅ Verify SuperAdmin
    const admin = await adminModel.findById(req.userId);
    if (!admin?.role || admin.role !== "super") {
      return res
        .status(400)
        .json({ message: "Course can only be created by SuperAdmin" });
    }

    // ✅ Process extra_facilities
    const facilities = Array.isArray(extra_facilities)
      ? extra_facilities
      : extra_facilities?.split(",").map((item) => item.trim()) || [];

    // ✅ Upload images to Cloudinary
    const cloudinaryImages = await Promise.all(
      req.files.map(async (file) =>
        uploadToCloudinary(file.buffer, crypto.randomUUID(), "courses")
      )
    );

    // ✅ Save new course
    const newCourse = new courseModel({
      course_name,
      course_full_name,
      course_content,
      course_duration,
      extra_facilities: facilities,
      image: cloudinaryImages,
    });

    await newCourse.save();

    res.status(201).json({
      message: "Course added successfully.",
      course: newCourse,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getCourses = async (req, res) => {
  try {
    const courses = await courseModel.find();
    res.status(200).json({ courses });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find();
    res.status(200).json({ branches });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const createBranch = async (req, res) => {
  try {
    const {
      branch_name,
      branch_address,
      google_map_link,
      email,
      mobile,
      branchId,
      branch_code,
    } = req.body;
    const files = req.files || [];

    // ✅ Validate required fields
    if (
      !branchId ||
      !branch_name ||
      !branch_address ||
      !google_map_link ||
      !email ||
      !mobile ||
      !branch_code||
      files.length === 0
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // ✅ Verify SuperAdmin
    const admin = await adminModel.findById(req.userId);
    if (!admin?.role || admin.role !== "super") {
      return res
        .status(403)
        .json({ message: "Branch can only be created by SuperAdmin." });
    }

    const existingBranch = await Branch.findOne({
      $or: [{ branchId }, { email }, { mobile }],
    });
    if (existingBranch) {
      let duplicateField = "";
      if (existingBranch.branchId === branchId) duplicateField = "Branch ID";
      else if (existingBranch.email === email) duplicateField = "Email";
      else if (existingBranch.mobile === mobile)
        duplicateField = "Mobile Number";

      return res
        .status(400)
        .json({ message: `${duplicateField} already exists.` });
    }

    // ✅ Upload images to Cloudinary
    const cloudinaryImages = await Promise.all(
      files.map(async (file) =>
        uploadToCloudinary(file.buffer, crypto.randomUUID(), "branches")
      )
    );

    // ✅ Create new branch with Cloudinary image URLs
    const newBranch = new Branch({
      branchId,
      branch_name: branch_name.trim(),
      branch_code,
      branch_address,
      google_map_link,
      email: email.trim(),
      mobile,
      image: cloudinaryImages, // Store Cloudinary URLs
    });

    await newBranch.save();

    res
      .status(201)
      .json({ message: "Branch created successfully.", branch: newBranch });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getRecentImages = async (req, res) => {
  try {
    const recentImages = await Image.find().limit(4);
    res.status(200).json(recentImages);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};


export const RecentImage = async (req, res) => {
  try {
    const files = req.files;
    // console.log("Received files:", files);

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    // ✅ Upload images to Cloudinary and get URLs
    const cloudinaryImages = await Promise.all(
      files.map(async (file) => {
        return await uploadToCloudinary(file.buffer, crypto.randomUUID(), "Recent Images");
      })
    );

    // console.log("Cloudinary URLs:", cloudinaryImages);

    // ✅ Save image URLs to MongoDB using the correct field name
    const savedImages = new Image({ images: cloudinaryImages }); // ✅ Updated field name
    await savedImages.save();

    res.status(201).json({
      message: "Images uploaded successfully",
      savedImages,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
