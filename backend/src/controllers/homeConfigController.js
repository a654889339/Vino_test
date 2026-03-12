const HomeConfig = require('../models/HomeConfig');
const cosUpload = require('../utils/cosUpload');
const path = require('path');

const FIELDS = ['section','title','desc','icon','color','path','price','sortOrder','status','imageUrl'];

exports.list = async (req, res) => {
  try {
    const where = {};
    if (req.query.section) where.section = req.query.section;
    if (!req.query.all) where.status = 'active';
    const items = await HomeConfig.findAll({ where, order: [['section','ASC'],['sortOrder','ASC'],['id','ASC']] });
    res.json({ code: 0, data: items });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const data = {};
    FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const item = await HomeConfig.create(data);
    res.json({ code: 0, data: item });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const item = await HomeConfig.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: '配置不存在' });
    const data = {};
    FIELDS.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    await item.update(data);
    res.json({ code: 0, data: item });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await HomeConfig.findByPk(req.params.id);
    if (!item) return res.status(404).json({ code: 1, message: '配置不存在' });
    await item.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};

// 上传首页配置图片（如开场动画logo）
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 1, message: '请选择图片文件' });
    }
    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `homeconfig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const url = await cosUpload.upload(req.file.buffer, filename, req.file.mimetype);
    res.json({ code: 0, data: { url } });
  } catch (e) {
    res.status(500).json({ code: 1, message: e.message });
  }
};
