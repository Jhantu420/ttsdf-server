


import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true }, // Unique user identifier
    name: { type: String, required: true },
    fathername: { type: String, required: true },
    mothername: { type: String, required: true },
    address: { type: String, required: true },
    dob: { type: String, required: true },
    dor: { type: String, required: true },
    gender: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    highestQualification: {type: String, required: true},
    image: { type: String, default: "" },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Password required for normal login (not for Google login)
    role: { type: String, required: true },
    branchName: { type: String, required: true },
    branchCode:{type: String, required: true},
    courseName: { type: String, required: true },
    activeStatus: { type: Boolean, default: true },
    
    // ✅ Google Login Fields
    // googleId: { type: String, default: null, unique: true, sparse: true }, // Unique Google ID for students using Google login

    // ✅ OTP-related fields (for normal login)
    verifyOtp: { type: String, default: "" },
    verifyOtpExpireAt: { type: Date, expires: 300 }, // 5minutes
    isVerified: { type: Boolean, default: false },
    resetOtp: { type: String, default: "" },
    resetOtpExpireAt: { type: Date, default: null },

    // ✅ Rate Limiting Fields
    otpRequestCount: { type: Number, default: 0 },
    otpRequestWindowStart: { type: Date, default: Date.now },
    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ TTL Index for OTP Expiry
userSchema.index({ verifyOtpExpireAt: 1 }, { expireAfterSeconds: 0 });

const userModel = mongoose.models.Users || mongoose.model("Users", userSchema);

export default userModel;
