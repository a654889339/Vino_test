const { Router } = require('express');
const authRoutes = require('./auth');
const serviceRoutes = require('./service');
const orderRoutes = require('./order');
const addressRoutes = require('./address');
const guideRoutes = require('./guide');
const homeConfigRoutes = require('./homeConfig');
const messageRoutes = require('./message');

const router = Router();

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/orders', orderRoutes);
router.use('/addresses', addressRoutes);
router.use('/guides', guideRoutes);
router.use('/home-config', homeConfigRoutes);
router.use('/messages', messageRoutes);

router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'Vino服务运行中', timestamp: new Date().toISOString() });
});


module.exports = router;
