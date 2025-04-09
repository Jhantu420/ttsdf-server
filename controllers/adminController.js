import bcrypt from "bcryptjs";
import validator from "validator";
import adminModel from "../model/adminModel.js";
import { generateOTP, sendOTP } from "../nodemailer.js";
import cloudinary from "../helper/cloudinary.js";
import streamifier from "streamifier";
import userModel from "../model/userModel.js";
import TeamModel from "../model/ourTeam.js";
import { Activity } from "../model/activityModel.js";

const registerAdmin = async (req, res) => {
  try {
    const { adminId, name, email, password, role, branchName, branchCode } =
      req.body;

    if ((!email || !name || !password || !role || !branchName, !branchCode)) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    const adminExists = await adminModel.findOne({ email });

    if (adminExists) {
      return res
        .status(400)
        .json({ success: false, message: "Admin already exists" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a strong password" });
    }

    // Handle Super Admin activation logic
    if (role === "super") {
      const activeSuperAdmin = await adminModel.findOne({
        role: "super",
        activeStatus: true,
      });
      if (activeSuperAdmin) {
        activeSuperAdmin.activeStatus = false;
        await activeSuperAdmin.save();
      }
    }

    // Generate Admin ID
    let newAdminId = adminId;
    if (!adminId) {
      const lastAdmin = await adminModel
        .findOne({ role, branchCode })
        .sort({ createdAt: -1 });
      let newNumber = "001";

      if (lastAdmin && lastAdmin.adminId) {
        const match = lastAdmin.adminId.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[0], 10);
          newNumber = String(lastNumber + 1).padStart(3, "0");
        }
      }

      newAdminId = `${role}/${branchCode}/${newNumber}`;
    }

    // OTP request limit and blocking logic
    const existingAdmin = await adminModel.findOne({ email });
    const windowTime = 60 * 60 * 1000; // 1 hour

    if (existingAdmin) {
      if (existingAdmin.isBlocked && existingAdmin.blockedUntil > new Date()) {
        const remaining = Math.ceil(
          (existingAdmin.blockedUntil - Date.now()) / 60000
        );
        return res.status(429).json({
          message: `Too many OTPs sent. Try again in ${remaining} min.`,
        });
      }

      if (Date.now() - existingAdmin.otpRequestWindowStart > windowTime) {
        existingAdmin.otpRequestCount = 0;
        existingAdmin.otpRequestWindowStart = new Date();
      }

      existingAdmin.otpRequestCount += 1;

      if (existingAdmin.otpRequestCount > 5) {
        existingAdmin.isBlocked = true;
        existingAdmin.blockedUntil = new Date(Date.now() + windowTime);
        await existingAdmin.save();
        return res
          .status(429)
          .json({ message: "Too many OTP requests. Blocked for 1 hour." });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // Expires in 10 min

    // Hash the OTP and password
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save admin
    const admin = new adminModel({
      adminId: newAdminId,
      email,
      name,
      password: hashedPassword,
      role,
      branchName,
      branchCode,
      isVerified: false,
      verifyOtp: hashedOtp,
      verifyOtpExpireAt: otpExpires,
      active: role === "super" ? true : undefined,
      otpRequestCount: 1,
      otpRequestWindowStart: new Date(),
    });

    await admin.save();

    // Send OTP via email
    const emailSent = await sendOTP(email, otp);

    if (!emailSent) {
      await adminModel.deleteOne({ email });
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

// Function for Super Admin to create Branch Admin
const createBranchAdmin = async (req, res) => {
  try {
    const { name, email, password, role, branchName, branchCode } = req.body;

    if (!email || !name || !password || !role || !branchName || !branchCode) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email format" });
    }

    // Check if email already exists in userModel
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email is already registered as a user" });
    }
    // Only Super admin can create branch admin

    const requestingAdmin = await adminModel.findById(req.userId);

    if (
      !requestingAdmin ||
      requestingAdmin.role !== "super" ||
      !requestingAdmin.activeStatus
    ) {
      return res.status(403).json({
        message:
          "Access denied, only active super admin can create branch admins",
      });
    }

    let admin = await adminModel.findOne({ email });

    // 🔒 Check if user is blocked BEFORE proceeding
    if (admin && admin.isBlocked && admin.blockedUntil > new Date()) {
      const remaining = Math.ceil((admin.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        message: `Too many OTPs sent. Try again in ${remaining} min.`,
      });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: "Enter a strong password" });
    }

    // 🔹 Generate Admin ID based on role & branch
    let adminId;
    if (!admin) {
      const lastAdmin = await adminModel
        .findOne({ role, branchCode })
        .sort({ createdAt: -1 });
      let newNumber = "001";

      if (lastAdmin) {
        const lastAdminId = lastAdmin.adminId;
        const match = lastAdminId.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[0], 10);
          newNumber = String(lastNumber + 1).padStart(3, "0");
        }
      }
      adminId = `${role}-${branchCode}-${newNumber}`;
    } else {
      adminId = admin.adminId;
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 1 + 60 * 1000);

    // Hash the OTP and password
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);
    const hashedPassword = await bcrypt.hash(password, salt);

    const windowTime = 60 * 60 * 1000;

    if (admin) {
      // Reset OTP request count if window expired
      if (Date.now() - admin.otpRequestWindowStart > windowTime) {
        admin.otpRequestCount = 0;
        admin.otpRequestWindowStart = new Date();
      }

      admin.otpRequestCount += 1;

      if (admin.otpRequestCount > 5) {
        admin.isBlocked = true;
        admin.blockedUntil = new Date(Date.now() + windowTime);
        await admin.save();
        return res
          .status(429)
          .json({ message: "Too many OTP requests. Blocked for 1 hour." });
      }

      // Update admin with new OTP and password
      admin.password = hashedPassword;
      admin.verifyOtp = hashedOtp;
      admin.verifyOtpExpireAt = otpExpires;
      await admin.save();
    } else {
      // Create new admin
      const admindata = new adminModel({
        adminId,
        email,
        name,
        password: hashedPassword,
        role,
        branchName,
        branchCode,
        isVerified: false,
        verifyOtp: hashedOtp,
        verifyOtpExpireAt: otpExpires,
        otpRequestCount: 1,
        otpRequestWindowStart: new Date(),
      });

      await admindata.save();
    }

    // Send OTP via email
    const emailSent = await sendOTP(email, otp);

    if (!emailSent) {
      if (!admin) await adminModel.deleteOne({ email });
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

const updateBranchAdmin = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    // Super Admin Check
    if (requestingAdmin.role !== "super" || !requestingAdmin.activeStatus) {
      return res.status(403).json({
        message:
          "Access denied. Only active Super Admins can update branch admins.",
      });
    }

    const { id } = req.params; // Branch Admin's ID to update
    const { name, email, branchName, activeStatus, role } = req.body;

    // Fetch existing admin
    const existingAdmin = await adminModel.findById(id);
    if (!existingAdmin) {
      return res.status(404).json({ message: "Branch Admin not found." });
    }

    let updatedAdminId = existingAdmin.adminId;

    // 🔄 Regenerate adminId if branchName or role changes
    if (
      (branchName && branchName !== existingAdmin.branchName) ||
      (role && role !== existingAdmin.role)
    ) {
      const lastAdmin = await adminModel
        .findOne({
          role: role || existingAdmin.role,
          branchName: branchName || existingAdmin.branchName,
        })
        .sort({ createdAt: -1 });

      let newNumber = "001";

      if (lastAdmin) {
        const match = lastAdmin.adminId.match(/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[0], 10);
          newNumber = String(lastNumber + 1).padStart(3, "0");
        }
      }

      updatedAdminId = `${role || existingAdmin.role}-${
        branchName || existingAdmin.branchName
      }-${newNumber}`;
    }

    // Update admin details
    const updatedAdmin = await adminModel.findByIdAndUpdate(
      id,
      {
        name: name || existingAdmin.name,
        email: email || existingAdmin.email,
        branchName: branchName || existingAdmin.branchName,
        activeStatus:
          activeStatus !== undefined
            ? activeStatus
            : existingAdmin.activeStatus,
        role: role || existingAdmin.role,
        adminId: updatedAdminId, // Updated adminId
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Branch Admin updated successfully.",
      data: updatedAdmin,
    });
  } catch (error) {
    console.error("Update Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/admin/delete-branch-admin/:id

const deleteBranchAdmin = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    // Check if Super Admin and active
    if (requestingAdmin.role !== "super" || !requestingAdmin.activeStatus) {
      return res.status(403).json({
        message:
          "Access denied. Only active Super Admins can delete branch admins.",
      });
    }

    const { id } = req.params; // Branch Admin ID

    const deletedAdmin = await adminModel.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return res.status(404).json({ message: "Branch Admin not found." });
    }

    res.status(200).json({
      success: true,
      message: "Branch Admin deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/admin/get-all-branch-admins

const getAllBranchAdmins = async (req, res) => {
  try {
    const requestingAdmin = await adminModel.findById(req.userId);

    // Check if Super Admin and active
    if (requestingAdmin.role !== "super" || !requestingAdmin.activeStatus) {
      return res.status(403).json({
        message:
          "Access denied. Only active Super Admins can view branch admins.",
      });
    }

    const branchAdmins = await adminModel.find({ role: "branchAdmin" });

    res.status(200).json({
      success: true,
      data: branchAdmins,
    });
  } catch (error) {
    console.error("Fetch Error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Function to upload image to Cloudinary
const uploadToCloudinary = (fileBuffer, fileName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "Team Member",
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

// Controller to create a team member
const createTeam = async (req, res) => {
  try {
    const { name, designation, description } = req.body;
    const file = req.file; // Multer handles file uploads

    if (!name || !designation || !description || !file) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Upload to Cloudinary
    const cloudinaryImage = await uploadToCloudinary(
      file.buffer,
      file.originalname.split(".")[0]
    );

    // Save to database
    const teamData = new TeamModel({
      name,
      designation,
      description,
      image: cloudinaryImage, // Store Cloudinary URL
    });

    await teamData.save();

    res.status(201).json({
      message: "Team member created successfully",
      data: teamData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeam = async (req, res) => {
  try {
    const data = await TeamModel.find();

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No team members found",
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find().sort({ createdAt: -1 });
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createActivity = async (req, res) => {
  const requestingAdmin = await adminModel.findById(req.userId);
  if (
    !requestingAdmin ||
    !["super"].includes(requestingAdmin.role)
  ) {
    return res.status(403).json({ message: "Access denied." });
  }
  
  const { title, videoUrl } = req.body;
  try {
    const newActivity = new Activity({ title, videoUrl });
    await newActivity.save();
    res.status(201).json(newActivity);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export {
  registerAdmin,
  createBranchAdmin,
  updateBranchAdmin,
  deleteBranchAdmin,
  getAllBranchAdmins,
  createTeam,
  getTeam,
  getAllActivities,
  createActivity,
};
