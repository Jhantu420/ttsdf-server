import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema(
  {
    branchId: { type: String, required: true },
    branch_name: { type: String, required: true },
    branch_code:{ type: String , required: true},
    branch_address: { type: String, required: true },
    google_map_link: { type: String, required: true },
    image: { type: [String], default: [] },
    email: { type: String, required: true },
    mobile: { type: String, default: "" }, // Allow multiple numbers
  },
  { timestamps: true }
);

const Branch = mongoose.models.Branch || mongoose.model("Branch", BranchSchema);

export default Branch;
