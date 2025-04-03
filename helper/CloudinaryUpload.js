import cloudinary from "./cloudinary.js";
import streamifier from "streamifier";

export const uploadToCloudinary = (fileBuffer, fileName, folder) => {
    return new Promise((resolve, reject)=>{
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: `${fileName}_${Date.now()}`,
            },
            (error, result) => {
                if (result) {
                    resolve(result.secure_url);
                } else {
                    reject(new Error(`Cloudinary Upload Error: ${error.message}`));
                }
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    })
}