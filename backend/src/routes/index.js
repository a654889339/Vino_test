const { Router } = require('express');
const authRoutes = require('./auth');
const serviceRoutes = require('./service');
const orderRoutes = require('./order');

const router = Router();

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/orders', orderRoutes);

router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'Vino服务运行中', timestamp: new Date().toISOString() });
});

module.exports = router;
