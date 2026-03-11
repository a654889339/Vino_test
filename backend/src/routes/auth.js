const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const authController = require('../controllers/authController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `avatar_${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

router.post('/send-code', authController.sendCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/wx-login', authController.wxLogin);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), authController.uploadAvatar);
router.get('/admin/users', authMiddleware, adminMiddleware, authController.adminGetUsers);

module.exports = router;
