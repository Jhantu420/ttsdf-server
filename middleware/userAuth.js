import userModel from "../model/userModel.js";
import adminModel from "../model/adminModel.js";

export const userAuth = async(req,res)=>{
    try {
        let user = await adminModel.findById(req.userId).select("-password");
        if(!user){
            user = await userModel.findById(req.userId).select("-password");
        }
        if(!user){
            return res.status(404).json({success:false, message:"user not found"});
        }
        res.json({
            success:true,user,message:"user is authenticated"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Server error"})
    }
}