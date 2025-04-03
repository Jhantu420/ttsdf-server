import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import userModel from "../model/userModel.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Google Login Handler
export const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    // 🔍 Verify Google Token
    const googleUser = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);

    const { email,sub: googleId } = googleUser.data;

    // 🔍 Check if the user exists in the database
    let user = await userModel.findOne({ email });

    // ⛔ Deny access if user does not exist
    if (!user) {
      return res.status(401).json({ message: "User not registered. Contact admin to register first." });
    }

    // ⛔ Deny access if the role is NOT "student"
    if (user.role !== "student") {
      return res.status(403).json({ message: "Only students can log in via Google." });
    }

    // 🔄 If student exists but has no Google ID, update the record
    if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    // ✅ Generate JWT Token
    const token = jwt.sign({ userId: user.userId,role: user.role }, JWT_SECRET, {
      expiresIn: "30d",
    });
 
    // 🍪 Set token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    res.json({ message: "Google login successful", token, user });
  } catch (error) {
    console.error("Google login failed:", error);
    res.status(401).json({ message: "Invalid Google token" });
  }
};
