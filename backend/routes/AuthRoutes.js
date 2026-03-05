const express = require('express');
const router = express.Router();
const authController = require('../controller/AuthController');
const middleware = require('../middleware/AuthToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const profilePicDir = path.join(__dirname, '..', 'uploads', 'profile-pictures');
if (!fs.existsSync(profilePicDir)) {
  fs.mkdirSync(profilePicDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure dir exists at upload time too (for ephemeral filesystems like Render)
    if (!fs.existsSync(profilePicDir)) {
      fs.mkdirSync(profilePicDir, { recursive: true });
    }
    cb(null, profilePicDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

router.post("/register", authController.register);
router.post("/login", authController.login);
router.put("/profile", middleware.verifyToken, authController.updateProfile);
router.put("/profile-picture", middleware.verifyToken, upload.single('profilePicture'), authController.updateProfilePicture);

router.use((error, req, res, next) => {
  console.error('AuthRoutes error:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File size too large. Maximum size is 5MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files uploaded.' });
    }
    return res.status(400).json({ success: false, message: 'File upload error: ' + error.message });
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({ success: false, message: 'Only image files are allowed.' });
  }
  
  return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
});

router.get("/auth/google", authController.googleAuth);
router.get("/auth/google/callback", authController.googleCallback);

module.exports = router;