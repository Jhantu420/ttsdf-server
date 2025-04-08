import express from "express";
import {
  createBranchAdmin,
  createTeam,
  deleteBranchAdmin,
  getAllBranchAdmins,
  getTeam,
  registerAdmin,
  updateBranchAdmin,
} from "../controllers/adminController.js";
import adminAuth from "../middleware/adminAuth.js";
import { resendOTP, unifiedVerifyOTPHelper } from "../helper/otpHelper.js";
import {
  applyCourse,
  applyInACourse,
  createUser,
  deleteNotification,
  deleteUser,
  getAllUsers,
  getNotificationData,
  getUserById,
  sendMsg,
  updateUser,
} from "../controllers/userController.js";
import upload from "../helper/multer.js";
import {
  addCourse,
  createBranch,
  getBranches,
  getCourses,
  getRecentImages,
  RecentImage,
} from "../controllers/courseController.js";
import {
  unifiedForgotPassword,
  unifiedLogin,
  unifiedlogout,
  unifiedResetPassword,
} from "../controllers/unifiedLoginLogoutForgetResetController.js";
import { googleLogin } from "../controllers/authController.js";
import { userAuth } from "../middleware/userAuth.js";

const router = express.Router();

// Auth
router.get("/get-user-details", adminAuth, userAuth);

// Admin
router.post("/register", registerAdmin); // Super admin registraton

// Bellow all perform by super admin
router.post("/branchadmin", adminAuth, createBranchAdmin);
router.get("/get-all-branch-admins", adminAuth, getAllBranchAdmins);
router.put("/update-branch-admin/:id", adminAuth, updateBranchAdmin);
router.delete("/delete-branch-admin/:id", adminAuth, deleteBranchAdmin);
router.post("/upload-image", adminAuth, upload.array("images", 5), RecentImage);
router.get("/recent", getRecentImages); // Fetch recent images
router.post("/create-team", adminAuth, upload.single("image"), createTeam);

// Unified Login , Logout, Forgor Password, Reset Password, Vefiry OTP
router.post("/login", unifiedLogin);
router.post("/logout", unifiedlogout);
router.post("/forgetPassword", unifiedForgotPassword);
router.post("/resetPassword/:token", unifiedResetPassword);
router.post("/resend-otp", resendOTP);
router.post("/verifyOtp", unifiedVerifyOTPHelper);

//User
router.post("/register-user",adminAuth,upload.array("images", 10),createUser);
router.post("/applyCourse", applyCourse);
router.get("/get-all-users", adminAuth, getAllUsers);
router.get("/get-user-by-id", adminAuth, getUserById);
router.put("/update-user/:id", adminAuth, upload.any(), updateUser);
router.delete("/delete-user/:id", adminAuth, deleteUser);
router.post("/apply-in-a-course", applyInACourse);
router.get("/get-team-member", getTeam);
router.post("/send-msg", sendMsg);
router.get("/get-notification", getNotificationData);
router.delete("/delete-notification/:id/:type", deleteNotification);


// Create Course
router.post("/addCourse", adminAuth, upload.array("images", 10), addCourse);
router.get("/getCourse", getCourses);

//Create Branch createBranch
router.post("/addBranch", adminAuth, upload.array("images", 10), createBranch);
router.get("/getBranches", getBranches);

// ✅ Google Login Route
router.post("/google-login", googleLogin);

export default router;
