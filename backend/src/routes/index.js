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

router.get('/qrcode', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ code: 1, message: '缺少 url 参数' });
    const QRCode = require('qrcode');
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    res.json({ code: 0, data: { dataUrl } });
  } catch (e) {
    res.status(500).json({ code: 1, message: '生成失败: ' + e.message });
  }
});

module.exports = router;
