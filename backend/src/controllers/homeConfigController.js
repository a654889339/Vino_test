const HomeConfig = require('../models/HomeConfig');

const FIELDS = ['section','title','desc','icon','color','path','price','sortOrder','status'];

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
