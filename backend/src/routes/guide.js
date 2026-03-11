const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const guideController = require('../controllers/guideController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/', guideController.list);
router.get('/admin/list', authMiddleware, adminMiddleware, guideController.adminList);
router.get('/:id', guideController.detail);
router.post('/admin', authMiddleware, adminMiddleware, guideController.create);
router.put('/admin/:id', authMiddleware, adminMiddleware, guideController.update);
router.delete('/admin/:id', authMiddleware, adminMiddleware, guideController.remove);
router.post('/admin/upload', authMiddleware, adminMiddleware, upload.single('file'), guideController.uploadImage);

module.exports = router;
