import mongoose from "mongoose";

export const connectDB = async() =>{
    try {
        if(!process.env.MONGO_URL){
            throw new Error("MONGO_URL is not defined. Check your env file");
        }
        const connect = await mongoose.connect(process.env.MONGO_URL,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`Database Connected:${connect.connection.host}`);
    } catch (error) {
        console.error(`Error:${error.message}`);
        process.exit(1);
        
    }
}
