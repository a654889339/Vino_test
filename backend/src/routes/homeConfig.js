const { Router } = require('express');
const multer = require('multer');
const ctrl = require('../controllers/homeConfigController');
const { authMiddleware: auth, adminMiddleware: adminOnly } = require('../middleware/auth');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', ctrl.list);
router.post('/', auth, adminOnly, ctrl.create);
router.put('/:id', auth, adminOnly, ctrl.update);
router.delete('/:id', auth, adminOnly, ctrl.remove);

// 图片上传
router.post('/upload', auth, adminOnly, upload.single('file'), ctrl.uploadImage);

module.exports = router;
