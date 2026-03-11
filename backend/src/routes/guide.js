const { Router } = require('express');
const guideController = require('../controllers/guideController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = Router();

router.get('/', guideController.list);
router.get('/admin', authMiddleware, adminMiddleware, guideController.adminList);
router.post('/admin', authMiddleware, adminMiddleware, guideController.create);
router.put('/admin/:id', authMiddleware, adminMiddleware, guideController.update);
router.delete('/admin/:id', authMiddleware, adminMiddleware, guideController.remove);

module.exports = router;
