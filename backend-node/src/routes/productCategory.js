const { Router } = require('express');
const multer = require('multer');
const productCategoryController = require('../controllers/productCategoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', authMiddleware, adminMiddleware, productCategoryController.list);
router.post('/', authMiddleware, adminMiddleware, productCategoryController.create);
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), productCategoryController.uploadImage);
router.put('/:id', authMiddleware, adminMiddleware, productCategoryController.update);
router.delete('/:id', authMiddleware, adminMiddleware, productCategoryController.remove);

module.exports = router;
