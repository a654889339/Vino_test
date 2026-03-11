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

exports.create = async (req, res) => {
  try {
    const { name, subtitle, icon, emoji, gradient, badge, tags, sections, sortOrder, status } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ code: 400, message: '名称不能为空' });
    const guide = await DeviceGuide.create({
      name: name.trim(),
      subtitle: (subtitle || '').trim(),
      icon: icon || 'setting-o',
      emoji: emoji || '',
      gradient: gradient || 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      badge: (badge || '').trim(),
      tags: tags || [],
      sections: sections || [],
      sortOrder: sortOrder || 0,
      status: status || 'active',
    });
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
    const { name, subtitle, icon, emoji, gradient, badge, tags, sections, sortOrder, status } = req.body;
    await guide.update({
      ...(name !== undefined && { name: name.trim() }),
      ...(subtitle !== undefined && { subtitle: subtitle.trim() }),
      ...(icon !== undefined && { icon }),
      ...(emoji !== undefined && { emoji }),
      ...(gradient !== undefined && { gradient }),
      ...(badge !== undefined && { badge: badge.trim() }),
      ...(tags !== undefined && { tags }),
      ...(sections !== undefined && { sections }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(status !== undefined && { status }),
    });
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
