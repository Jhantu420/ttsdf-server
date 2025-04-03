import mongoose from 'mongoose';

const applyACourseAchema = new mongoose.Schema(
    {
        courseName:{type:String, required: true},
        name : {type :String, required: true},
        ph: {type: String, required: true}
    },
    {
        timestamps:true
    }
)

const applyCourseModel = mongoose.model.applyACourse || mongoose.model("applyACourse", applyACourseAchema);
export default applyCourseModel;