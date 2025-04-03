import adminModel from "../model/adminModel.js";
import userModel from "../model/userModel.js";
import bcrypt from "bcryptjs";
import { generateOTP, sendOTP } from "../nodemailer.js";

const unifiedVerifyOTPHelper = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "OTP required",
      });
    }

    let user =
      (await adminModel.findOne({ email })) ||
      (await userModel.findOne({ email }));

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Already verified" });
    }

    if (Date.now() > user.verifyOtpExpireAt) {
      await (user instanceof adminModel ? adminModel : userModel).deleteOne({
        email,
      });
      return res
        .status(400)
        .json({ message: "OTP expired, please register again" });
    }

    const isMatch = await bcrypt.compare(otp, user.verifyOtp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.verifyOtp = "";
    user.verifyOtpExpireAt = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully!",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const student = await userModel.findOne({ email });
    if (!student) {
      return res
        .status(400)
        .json({ success: false, message: " Student not found" });
    }
    if (student.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Student is already verified" });
    }
    if (student.verifyOtpExpireAt > new Date()) {
      return res
        .status(400)
        .json({ message: "OTP is still valid . Please wait" });
    }
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minute

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    student.verifyOtp = hashedOtp;
    student.verifyOtpExpireAt = otpExpires;
    student.otpRequestCount += 1;
    student.otpRequestWindowStart = new Date();
    await student.save();

    const emailSent = await sendOTP(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Error sending OTP" });
    }

    res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error".error);
    res.status(400).json({message:"Server Error"});
  }
};

export { unifiedVerifyOTPHelper, resendOTP };
