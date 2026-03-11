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

router.post('/guides/:id/qrcode', async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const cosUpload = require('../utils/cosUpload');
    const DeviceGuide = require('../models/DeviceGuide');
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 1, message: '商品不存在' });
    const forceRegen = req.body && req.body.force;
    if (guide.qrcodeUrl && !forceRegen) return res.json({ code: 0, data: { url: guide.qrcodeUrl } });
    const frontendBase = (process.env.FRONTEND_URL || 'http://106.54.50.88:5201');
    const pageUrl = frontendBase + '/guide/' + guide.id;
    const buffer = await QRCode.toBuffer(pageUrl, { width: 400, margin: 2, type: 'png' });
    const filename = `qrcode_guide_${guide.id}_${Date.now()}.png`;
    const cosUrl = await cosUpload.upload(buffer, filename, 'image/png');
    guide.qrcodeUrl = cosUrl;
    await guide.save();
    res.json({ code: 0, data: { url: cosUrl } });
  } catch (e) {
    console.error('[QR] generate error:', e.message);
    res.status(500).json({ code: 1, message: '生成失败: ' + e.message });
  }
});

module.exports = router;
