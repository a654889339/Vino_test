const { Service } = require('../models');

const ALLOWED_FIELDS = ['title', 'description', 'icon', 'cover', 'category', 'price', 'status', 'sortOrder'];

const pickFields = (body) => {
  const result = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
};

exports.list = async (req, res) => {
  try {
    const { category } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const where = { status: 'active' };
    if (category) where.category = String(category);

    const { count, rows } = await Service.findAndCountAll({
      where,
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    res.json({
      code: 0,
      data: { list: rows, total: count, page, pageSize },
    });
  } catch (err) {
    console.error('[Service] list error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务列表失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    res.json({ code: 0, data: service });
  } catch (err) {
    console.error('[Service] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取服务详情失败' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.title || !data.category) {
      return res.status(400).json({ code: 400, message: '标题和分类不能为空' });
    }
    if (data.price !== undefined) data.price = parseFloat(data.price) || 0;
    if (data.sortOrder !== undefined) data.sortOrder = parseInt(data.sortOrder, 10) || 0;
    const service = await Service.create(data);
    res.json({ code: 0, data: service });
  } catch (err) {
    console.error('[Service] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建服务失败' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    const data = pickFields(req.body);
    if (data.price !== undefined) data.price = parseFloat(data.price) || 0;
    if (data.sortOrder !== undefined) data.sortOrder = parseInt(data.sortOrder, 10) || 0;
    await service.update(data);
    res.json({ code: 0, data: service });
  } catch (err) {
    console.error('[Service] update error:', err.message);
    res.status(500).json({ code: 500, message: '更新服务失败' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的服务ID' });
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ code: 404, message: '服务不存在' });
    await service.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Service] remove error:', err.message);
    res.status(500).json({ code: 500, message: '删除服务失败' });
  }
};
