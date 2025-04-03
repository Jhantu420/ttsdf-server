

import multer from "multer";

// ✅ Multer Memory Storage Setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

export default upload;
