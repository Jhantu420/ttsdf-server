import cloudinary from "../helper/cloudinary.js";
import userModel from "../model/userModel.js";
import adminModel from "../model/adminModel.js";
import bcrypt from "bcryptjs";
import validator from "validator";
import streamifier from "streamifier";
import { generateOTP, sendOTP } from ".././nodemailer.js";
import applyModel from "../model/applyCourse.js";
import applyACourse from "../model/applyInACourse.js";
import SendMessageModel from "../model/sendMsg.js";

const createUser = async (req, res) => {
  try {
    const {
      name,
      fathername,
      mothername,
      address,
      dob,
      dor,
      gender,
      mobile,
      email,
      password,
      role,
      branchName,
      branchCode,
      courseName,
      courseDuration,
      marks,
      highestQualification,
    } = req.body;

    const files = req.files || []; // ✅ Define files here
    // ✅ Validate required fields
    if (
      !name ||
      !fathername ||
      !mothername ||
      !address ||
      !dob ||
      !dor ||
      !gender ||
      !mobile ||
      !email ||
      !password ||
      !role ||
      !branchName ||
      !branchCode ||
      !courseName ||
      !courseDuration ||
      !highestQualification ||
      files.length === 0
    ) {
      return res.status(400).json({
        message: "All required fields and at least one image must be provided.",
      });
    }

    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }
    // Check if email already exists in userModel
    const existingAdmin = await adminModel.findOne({ email });
    if (existingAdmin) {
      return res
        .status(400)
        .json({ message: "Email is already registered as a Admin" });
    }

    // ✅ Verify Admin Permissions
    const requestingAdmin = await adminModel.findById(req.userId);
    if (
      !requestingAdmin ||
      (requestingAdmin.role !== "super" &&
        requestingAdmin.role !== "branchAdmin")
    ) {
      return res.status(403).json({
        message:
          "Access denied, only super admin or branch admin can create student",
      });
    }

    if (
      requestingAdmin.role === "branchAdmin" &&
      requestingAdmin.branchName !== branchName
    ) {
      return res.status(403).json({
        message: "Branch Admin can only add students to their own branch",
      });
    }

    // ✅ Check if user already exists
    let student = await userModel.findOne({ email });
    if (student) {
      if (student.isVerified) {
        return res.status(400).json({
          success: false,
          message: "User with this email already exists and is verified.",
        });
      } else {
        // ✅ Handle unverified user (resend OTP)
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

        const salt = await bcrypt.genSalt(10);
        const hashedOtp = await bcrypt.hash(otp, salt);
        const hashedPassword = await bcrypt.hash(password, salt);

        student.password = hashedPassword;
        student.verifyOtp = hashedOtp;
        student.verifyOtpExpireAt = otpExpires;
        await student.save();

        const emailSent = await sendOTP(email, otp);
        if (!emailSent) {
          return res
            .status(500)
            .json({ success: false, message: "Error resending OTP" });
        }

        return res.status(200).json({
          success: true,
          message: "User already registered but not verified. OTP resent.",
        });
      }
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a strong password" });
    }

    // 🔹 Generate Student ID
    let userId;
    const lastStudent = await userModel
      .findOne({ role, branchCode })
      .sort({ createdAt: -1 });
    let newNumber = "001";

    if (lastStudent) {
      const lastUserId = lastStudent.userId;
      const match = lastUserId.match(/(\d+)$/);
      if (match) {
        const lastNumber = parseInt(match[0], 10);
        newNumber = String(lastNumber + 1).padStart(3, "0");
      }
    }
    userId = `RYIT/WB-${branchCode}/${newNumber}`;

    // ✅ Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Upload files directly to Cloudinary
    const uploadToCloudinary = (fileBuffer, fileName) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "students",
            public_id: `${fileName}_${Date.now()}`,
          },
          (error, result) => {
            if (result) {
              resolve(result.secure_url);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };
    const cloudinaryImages = await Promise.all(
      files.map(async (file) => {
        const resultUrl = await uploadToCloudinary(
          file.buffer,
          file.originalname.split(".")[0]
        );
        return resultUrl;
      })
    );

    // ✅ Create new student
    const studentData = new userModel({
      userId,
      name,
      fathername,
      mothername,
      address,
      dob,
      dor,
      gender,
      mobile,
      email,
      password: hashedPassword,
      role,
      branchName,
      courseName,
      courseDuration,
      marks,
      branchCode,
      highestQualification,
      isVerified: false,
      verifyOtp: hashedOtp,
      verifyOtpExpireAt: otpExpires,
      otpRequestCount: 1,
      otpRequestWindowStart: new Date(),
      image: cloudinaryImages[0], // Store Cloudinary URLs
    });

    await studentData.save();

    // ✅ Send OTP via email
    const emailSent = await sendOTP(email, otp);

    if (!emailSent) {
      await userModel.deleteOne({ email });
      return res
        .status(500)
        .json({ success: false, message: "Error sending OTP" });
    }

    res
      .status(200)
      .json({ success: true, message: "OTP sent to email. Please verify." });
  } catch (error) {
    console.error("Registration Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};
const updateUser = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    if (
      !requestingAdmin ||
      !["super", "branchAdmin"].includes(requestingAdmin.role)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { id } = req.params;
    const {
      name,
      fathername,
      mothername,
      address,
      dob,
      dor,
      gender,
      mobile,
      email,
      branchName, // optional if changing branch
      marks,
      grade,
      activeStatus, // new field for status toggle
    } = req.body;

    const files = req.files || []; // handling new image uploads

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Restrict Branch Admin from updating users outside their branch
    if (
      requestingAdmin.role === "branchAdmin" &&
      requestingAdmin.branchName !== user.branchName
    ) {
      return res
        .status(403)
        .json({ message: "Cannot update users from other branches." });
    }

    // If Super Admin is changing the user's branchName, regenerate userId
    if (
      requestingAdmin.role === "super" &&
      branchName &&
      branchName !== user.branchName
    ) {
      const lastStudent = await userModel
        .findOne({ role: user.role, branchName })
        .sort({ createdAt: -1 });

      let newNumber = "001";
      if (lastStudent) {
        const match = lastStudent.userId.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[0], 10);
          newNumber = String(lastNumber + 1).padStart(3, "0");
        }
      }
      user.userId = `${user.role}/${branchName}/${newNumber}`;
      user.branchName = branchName; // Update the branch name
    }

    // 🔥 Upload new image if provided
    if (files.length > 0) {
      const uploadToCloudinary = (fileBuffer, fileName) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "students",
              public_id: `${fileName}_${Date.now()}`,
            },
            (error, result) => {
              if (result) {
                resolve(result.secure_url);
              } else {
                reject(error);
              }
            }
          );
          streamifier.createReadStream(fileBuffer).pipe(stream);
        });
      };

      const cloudinaryImages = await Promise.all(
        files.map(async (file) => {
          const resultUrl = await uploadToCloudinary(
            file.buffer,
            file.originalname.split(".")[0]
          );
          return resultUrl;
        })
      );

      // Update user's image
      user.image = cloudinaryImages[0];
    }

    // 🔥 Update user fields
    Object.assign(user, {
      name: name || user.name,
      fathername: fathername || user.fathername,
      mothername: mothername || user.mothername,
      address: address || user.address,
      dob: dob || user.dob,
      dor: dor || user.dor,
      gender: gender || user.gender,
      mobile: mobile || user.mobile,
      email: email || user.email,
      marks: marks || user.marks,
      grade: grade || user.grade,
      activeStatus:
        activeStatus !== undefined ? activeStatus : user.activeStatus, // handle active status
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const applyCourse = async (req, res) => {
  const { name, mobile, email, center, course } = req.body;
  if (!name || !mobile || !center || !course) {
    return res
      .status(400)
      .json({ message: "name, mobile, center, course are required" });
  }

  let checkApply = await applyModel.findOne({ mobile });
  if (checkApply) {
    return res
      .status(400)
      .json({ success: false, message: "Already applied with this number" });
  }
  const applyData = new applyModel({
    name,
    mobile,
    email,
    center,
    course,
  });
  await applyData.save();
  return res
    .status(200)
    .json({ success: true, message: "Applied . We will contact you soon" });
};

const sendMsg = async (req, res) => {
  try {
    const { name, ph, email, msg } = req.body;
    if (!name || !ph || !msg) {
      return res.status(400).json({
        success: false,
        message: "name , phone & message are required",
      });
    }
    let checkPh = await SendMessageModel.findOne({ ph });
    if (checkPh) {
      return res
        .status(400)
        .json({ success: true, message: "Already applyed with thi phone no" });
    }
    const applyData = new SendMessageModel({
      name,
      ph,
      email,
      msg,
    });
    await applyData.save();
    return res
      .status(200)
      .json({ success: true, message: "We will contact you" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
const getNotificationData = async (req, res) => {
  try {
    // Fetch data counts from three models
    const applyDataCount = await applyModel.countDocuments();
    const applyCourseCount = await applyACourse.countDocuments();
    const sendMsgCount = await SendMessageModel.countDocuments();
    // Fetch data from three models
    const applyData = await applyModel.find();
    const applyCourse = await applyACourse.find();
    const sendMsg = await SendMessageModel.find();
    return res.status(200).json({
      success: true,
      data: {
        branchCourseCount: applyDataCount,
        totalCount: applyDataCount + applyCourseCount + sendMsgCount,
        applyData,
        applyCourse,
        sendMsg,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error });
  }
};
const deleteNotification = async (req, res) => {
  try {
    const { id, type } = req.params; // Get id and type from request params

    let deletedMessage;
    if (type === "applyData") {
      deletedMessage = await applyModel.findByIdAndDelete(id);
    } else if (type === "applyCourse") {
      deletedMessage = await applyACourse.findByIdAndDelete(id);
    } else if (type === "sendMsg") {
      deletedMessage = await SendMessageModel.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    if (!deletedMessage) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    if (
      !requestingAdmin ||
      !["super", "branchAdmin"].includes(requestingAdmin.role)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { id } = req.params;

    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (
      requestingAdmin.role === "branchAdmin" &&
      requestingAdmin.branchName !== user.branchName
    ) {
      return res
        .status(403)
        .json({ message: "Cannot delete users from other branches." });
    }

    await userModel.findByIdAndDelete(id);

    res
      .status(200)
      .json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const getAllUsers = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    if (
      !requestingAdmin ||
      !["super", "branchAdmin"].includes(requestingAdmin.role)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }

    let filter = {};
    if (requestingAdmin.role === "branchAdmin") {
      filter.branchName = requestingAdmin.branchName;
    }

    const users = await userModel.find(filter);

    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const applyInACourse = async (req, res) => {
  const { courseName, name, ph } = req.body;
  if (!courseName || !name || !ph) {
    res.status(400).json({ message: "All field are required" });
  }
  const existingph = await applyACourse.findOne({ ph });
  if (existingph) {
    return res.status(400).json({
      message: "With this mobile no already applied. We will contact you soon",
    });
  }
  const courseData = new applyACourse({
    courseName,
    name,
    ph,
  });
  await courseData.save();
  return res
    .status(200)
    .json({ success: true, message: "Applied, We will contact you soon" });
};


const getUserById = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    if (
      !requestingAdmin ||
      !["super", "branchAdmin"].includes(requestingAdmin.role)
    ) {
      return res.status(403).json({ message: "Access denied." });
    }
    const {userId} = req.body;
    
    if (!userId) {
      return res.status(404).json({ message: "Registration number is required." });
    }
    const user = await userModel.findOne({userId});

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    // Restrict Branch Admin from generating users certificate outside their branch
    if (
      requestingAdmin.role === "branchAdmin" &&
      requestingAdmin.branchName !== user.branchName
    ) {
      return res
        .status(403)
        .json({ message: "Cannot generate certificate from other branches." });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export {
  createUser,
  applyCourse,
  updateUser,
  deleteUser,
  getAllUsers,
  applyInACourse,
  sendMsg,
  getNotificationData,
  deleteNotification,
  getUserById,
};
