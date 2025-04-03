import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

// Function to generate random 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

// Function to send OTP via email
export const sendOTP = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER, // Your email from .env
        pass: process.env.SMTP_PASS, // App password
      },
    });

    const mailOptions = {
      from: `"TTSDF FOUNDATION" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "OTP VERIFICATION",
      text: `Your OTP is: ${otp}`,
      html: `<p>Your OTP is: <b>${otp}</b>. It is valid for 5 minutes.</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log("OTP sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending OTP:", error);
    return false;
  }
};
