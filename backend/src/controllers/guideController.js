const path = require('path');
const { DeviceGuide } = require('../models');

exports.list = async (req, res) => {
  try {
    const guides = await DeviceGuide.findAll({
      where: { status: 'active' },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: guides });
  } catch (err) {
    console.error('[Guide] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务指南失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    res.json({ code: 0, data: guide });
  } catch (err) {
    console.error('[Guide] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const guides = await DeviceGuide.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: guides });
  } catch (err) {
    console.error('[Guide] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
};

const GUIDE_FIELDS = [
  'name','subtitle','icon','emoji','gradient','badge',
  'tags','sections','sortOrder','status',
  'coverImage','showcaseVideo','description','mediaItems','helpItems',
];

exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '名称不能为空' });
    const data = {};
    GUIDE_FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    data.name = name.trim();
    if (data.subtitle) data.subtitle = data.subtitle.trim();
    if (data.badge) data.badge = data.badge.trim();
    const guide = await DeviceGuide.create(data);
    res.json({ code: 0, data: guide });
  } catch (err) {
    console.error('[Guide] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    const data = {};
    GUIDE_FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (data.name) data.name = data.name.trim();
    if (data.subtitle) data.subtitle = data.subtitle.trim();
    if (data.badge !== undefined) data.badge = (data.badge || '').trim();
    await guide.update(data);
    res.json({ code: 0, data: guide });
  } catch (err) {
    console.error('[Guide] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const guide = await DeviceGuide.findByPk(req.params.id);
    if (!guide) return res.status(404).json({ code: 404, message: '不存在' });
    await guide.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Guide] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '未选择文件' });
    const cosUpload = require('../utils/cosUpload');
    const ext = path.extname(req.file.originalname) || '.bin';
    const filename = `guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const url = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    res.json({ code: 0, data: { url } });
  } catch (err) {
    console.error('[Guide] uploadFile error:', err.message);
    res.status(500).json({ code: 500, message: '上传失败: ' + err.message });
  }
};
