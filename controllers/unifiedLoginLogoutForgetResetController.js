import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import adminModel from "../model/adminModel.js";
import userModel from "../model/userModel.js";
import { generateOTP, sendOTP } from "../nodemailer.js";

// 🔑 Generate Password Reset Token
const generateResetToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_RESET_SECRET, {
    expiresIn: "5m",
  });
};

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const unifiedLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let user = await adminModel.findOne({ email });
    let role;

    if (user) {
      role = user.role;

      // Check active status for Admin
      if (!user.activeStatus) {
        return res.status(400).json({
          success: false,
          message: "Admin account is not active. Please contact Super Admin.",
        });
      }
    } else {
      // If not found in adminModel, check userModel
      user = await userModel.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      role = user.role;

      // Check active status for User
      if (!user.activeStatus) {
        return res.status(400).json({
          success: false,
          message: "User account is not active. Please contact support.",
        });
      }
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = generateToken(user._id, role);

    // Set the token in a cookie for 30 days
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Logout function
const unifiedlogout = async (req, res) => {
  try {
    res.clearCookie("authToken", {
      httpOnly: true, // Prevent JavaScript access (protects against XSS)
      secure: process.env.NODE_ENV === "production", // Use HTTPS in production
      sameSite: "Strict", // Protects against CSRF
    });
    return res.status(201).json({ success: true, message: "Logged Out" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

const unifiedForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    let user = await adminModel.findOne({ email });
    let role;

    if (user) {
      role = user.role;
    } else {
      user = await userModel.findOne({ email });
      if (user) {
        role = user.role;
      }
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid email" });
    }

    // Generate reset token
    const resetToken = generateResetToken(user._id, role);

    // Create reset URL
    const resetURL = `${process.env.CLIENT_URL}/resetPassword/${resetToken}`;

    // Send Email
    const emailSent = await sendOTP(
      email,
      `Click the link to reset your password: ${resetURL}`
    );

    if (!emailSent)
      return res.status(500).json({ message: "Error sending reset email" });

    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const unifiedResetPassword = async (req, res) => {
    try {
      const { token } = req.params;
      const { newPassword } = req.body;
  
      if (!newPassword || newPassword.length < 8) {
        return res
          .status(400)
          .json({ message: "Password must be at least 8 characters" });
      }
  
      // Verify Token
      const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
  
      // Check in both adminModel and userModel
      let user = await adminModel.findById(decoded.id);
      if (!user) user = await userModel.findById(decoded.id);
  
      if (!user) return res.status(404).json({ message: "User not found" });
  
      // Hash New Password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
  
      // Update Password
      user.password = hashedPassword;
      await user.save();
  
      res.status(200).json({ success: true, message: "Password reset successful" });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({ message: "Reset token expired" });
      }
      res.status(500).json({ message: error.message });
    }
  };

export { unifiedLogin, unifiedlogout, unifiedForgotPassword, unifiedResetPassword };
