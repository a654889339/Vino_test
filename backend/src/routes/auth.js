const { Router } = require('express');
const authController = require('../controllers/authController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.post('/send-code', authController.sendCode);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/admin/users', authMiddleware, adminMiddleware, authController.adminGetUsers);

module.exports = router;
