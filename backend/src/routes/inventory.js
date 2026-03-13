const { Router } = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/categories', authMiddleware, adminMiddleware, inventoryController.listCategories);
router.post('/categories', authMiddleware, adminMiddleware, inventoryController.createCategory);
router.put('/categories/:id', authMiddleware, adminMiddleware, inventoryController.updateCategory);
router.delete('/categories/:id', authMiddleware, adminMiddleware, inventoryController.removeCategory);

router.get('/products', authMiddleware, adminMiddleware, inventoryController.listProducts);
router.post('/products', authMiddleware, adminMiddleware, inventoryController.createProduct);
router.put('/products/:id', authMiddleware, adminMiddleware, inventoryController.updateProduct);
router.delete('/products/:id', authMiddleware, adminMiddleware, inventoryController.removeProduct);

router.get('/products/:id/bind-qr-url', authMiddleware, adminMiddleware, inventoryController.getBindQrUrl);

module.exports = router;
