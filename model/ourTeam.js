import mongoose from 'mongoose';

const TeamSchema = new mongoose.Schema(
    {
        image: {type:String, default:[]},
        name: {type: String, required:true},
        designation:{type: String, required:true},
        description: {type: String, required: true}
    },
    {timestamps:true}
);

const TeamModel = mongoose.models.our_team_member || mongoose.model("our_team_member", TeamSchema);

export default TeamModel;