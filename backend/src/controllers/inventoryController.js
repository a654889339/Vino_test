const { InventoryCategory, InventoryProduct } = require('../models');

/** 管理端：种类列表 */
exports.listCategories = async (req, res) => {
  try {
    const list = await InventoryCategory.findAll({
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[Inventory] listCategories error:', err.message);
    res.status(500).json({ code: 500, message: '获取种类列表失败' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, sortOrder, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '种类名称不能为空' });
    const cat = await InventoryCategory.create({
      name: name.trim(),
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
    });
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[Inventory] createCategory error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await InventoryCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const { name, sortOrder, status } = req.body;
    if (name !== undefined) cat.name = name.trim();
    if (sortOrder !== undefined) cat.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) cat.status = status;
    await cat.save();
    res.json({ code: 0, data: cat });
  } catch (err) {
    console.error('[Inventory] updateCategory error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.removeCategory = async (req, res) => {
  try {
    const cat = await InventoryCategory.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ code: 404, message: '种类不存在' });
    const count = await InventoryProduct.count({ where: { categoryId: cat.id } });
    if (count > 0) return res.status(400).json({ code: 400, message: '该种类下还有商品，请先删除或移出商品' });
    await cat.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Inventory] removeCategory error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

/** 管理端：商品列表（支持种类、状态筛选与名称/序列号关键词查找） */
exports.listProducts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { categoryId, status, keyword } = req.query;
    const where = {};
    if (categoryId != null && categoryId !== '') where.categoryId = categoryId;
    if (status != null && status !== '') where.status = status;
    if (keyword != null && String(keyword).trim() !== '') {
      const kw = '%' + String(keyword).trim().replace(/%/g, '\\%') + '%';
      where[Op.or] = [
        { name: { [Op.like]: kw } },
        { serialNumber: { [Op.like]: kw } },
      ];
    }
    const list = await InventoryProduct.findAll({
      where,
      include: [{ model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }],
      order: [['categoryId', 'ASC'], ['sortOrder', 'ASC'], ['id', 'ASC']],
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[Inventory] listProducts error:', err.message);
    res.status(500).json({ code: 500, message: '获取商品列表失败' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { categoryId, name, serialNumber, guideSlug, sortOrder, status } = req.body;
    if (!categoryId) return res.status(400).json({ code: 400, message: '请选择种类' });
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '商品名称不能为空' });
    if (!serialNumber || !String(serialNumber).trim()) return res.status(400).json({ code: 400, message: '序列号不能为空' });
    const sn = String(serialNumber).trim();
    const existing = await InventoryProduct.findOne({ where: { serialNumber: sn } });
    if (existing) return res.status(400).json({ code: 400, message: '该序列号已存在' });
    const cat = await InventoryCategory.findByPk(categoryId);
    if (!cat) return res.status(400).json({ code: 400, message: '种类不存在' });
    const product = await InventoryProduct.create({
      categoryId,
      name: name.trim(),
      serialNumber: sn,
      guideSlug: guideSlug != null ? String(guideSlug).trim() : '',
      sortOrder: parseInt(sortOrder, 10) || 0,
      status: status || 'active',
    });
    res.json({ code: 0, data: product });
  } catch (err) {
    console.error('[Inventory] createProduct error:', err.message);
    res.status(500).json({ code: 500, message: '创建失败' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    const { categoryId, name, serialNumber, guideSlug, sortOrder, status } = req.body;
    if (categoryId != null) product.categoryId = categoryId;
    if (name !== undefined) product.name = name.trim();
    if (serialNumber !== undefined && String(serialNumber).trim()) {
      const sn = String(serialNumber).trim();
      if (sn !== product.serialNumber) {
        const existing = await InventoryProduct.findOne({ where: { serialNumber: sn } });
        if (existing) return res.status(400).json({ code: 400, message: '该序列号已被其他商品使用' });
        product.serialNumber = sn;
      }
    }
    if (guideSlug !== undefined) product.guideSlug = String(guideSlug).trim();
    if (sortOrder !== undefined) product.sortOrder = parseInt(sortOrder, 10) || 0;
    if (status !== undefined) product.status = status;
    await product.save();
    res.json({ code: 0, data: product });
  } catch (err) {
    console.error('[Inventory] updateProduct error:', err.message);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
};

exports.removeProduct = async (req, res) => {
  try {
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    await product.destroy();
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('[Inventory] removeProduct error:', err.message);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
};

/** 管理端：生成绑定用二维码 URL 及图片（dataUrl 供前端展示） */
exports.getBindQrUrl = async (req, res) => {
  try {
    const QRCode = require('qrcode');
    const product = await InventoryProduct.findByPk(req.params.id);
    if (!product) return res.status(404).json({ code: 404, message: '商品不存在' });
    const frontendBase = process.env.FRONTEND_URL || 'http://106.54.50.88:5201';
    let bindUrl = `${frontendBase}/bind-product?sn=${encodeURIComponent(product.serialNumber)}`;
    if (product.guideSlug && String(product.guideSlug).trim()) {
      bindUrl += '&guide=' + encodeURIComponent(String(product.guideSlug).trim());
    }
    const dataUrl = await QRCode.toDataURL(bindUrl, { width: 400, margin: 2 });
    res.json({ code: 0, data: { url: bindUrl, serialNumber: product.serialNumber, dataUrl } });
  } catch (err) {
    console.error('[Inventory] getBindQrUrl error:', err.message);
    res.status(500).json({ code: 500, message: '获取失败' });
  }
};
