const { Router } = require('express');
const authRoutes = require('./auth');
const serviceRoutes = require('./service');

const router = Router();

router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);

router.get('/health', (req, res) => {
  res.json({ code: 0, message: 'Vino服务运行中', timestamp: new Date().toISOString() });
});

module.exports = router;
