import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    branchName: {
      type: String,
      required: true,
    },
    branchCode:{
      type:String,
      required: true
    },
    verifyOtp: {
      type: String,
      default: "",
    },
    verifyOtpExpireAt: {
      type: Date,
      expires: 600, // ⏳ TTL Index (60 seconds)
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    resetOtp: {
      type: String,
      default: "",
    },
    activeStatus:{
      type: Boolean,
      default: true,
    },
    resetOtpExpireAt: {
      type: Date, // Changed from Number to Date for consistency
      default: null,
    },

    // 🛡️ Rate Limiting Fields
    otpRequestCount: { type: Number, default: 0 },
    otpRequestWindowStart: { type: Date, default: Date.now },
    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ✅ Create TTL index for automatic deletion based on verifyOtpExpireAt
adminSchema.index({ verifyOtpExpireAt: 1 }, { expireAfterSeconds: 0 });

const adminModel =
  mongoose.models.Admin || mongoose.model("Admin", adminSchema);

export default adminModel;
