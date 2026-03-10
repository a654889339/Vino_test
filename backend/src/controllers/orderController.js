const { Order, User } = require('../models');

function generateOrderNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `VN${y}${m}${d}${h}${mi}${s}${rand}`;
}

const STATUS_MAP = {
  pending: { text: '待支付', type: 'warning' },
  paid: { text: '已支付', type: 'primary' },
  processing: { text: '进行中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'default' },
};

exports.create = async (req, res) => {
  try {
    const { serviceId, serviceTitle, serviceIcon, price, contactName, contactPhone, address, appointmentTime, remark } = req.body;
    if (!serviceTitle || !price) {
      return res.status(400).json({ code: 400, message: '服务信息不完整' });
    }
    const order = await Order.create({
      orderNo: generateOrderNo(),
      userId: req.user.id,
      serviceId: serviceId || null,
      serviceTitle,
      serviceIcon: serviceIcon || 'setting-o',
      price,
      contactName: contactName || '',
      contactPhone: contactPhone || '',
      address: address || '',
      appointmentTime: appointmentTime || null,
      remark: remark || '',
      status: 'pending',
    });
    res.json({ code: 0, data: order });
  } catch (err) {
    console.error('[Order] create error:', err.message);
    res.status(500).json({ code: 500, message: '创建订单失败' });
  }
};

exports.myOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { userId: req.user.id };
    if (status && status !== 'all') {
      where.status = status;
    }
    const orders = await Order.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    const list = orders.map((o) => {
      const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
      return { ...o.toJSON(), statusText: s.text, statusType: s.type };
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    console.error('[Order] myOrders error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单失败' });
  }
};

exports.detail = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权查看' });
    }
    const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[Order] detail error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单详情失败' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '无权操作' });
    }
    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ code: 400, message: '当前状态无法取消' });
    }
    order.status = 'cancelled';
    await order.save();
    res.json({ code: 0, message: '订单已取消' });
  } catch (err) {
    console.error('[Order] cancel error:', err.message);
    res.status(500).json({ code: 500, message: '取消订单失败' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email', 'nickname'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
    });
    const list = rows.map((o) => {
      const s = STATUS_MAP[o.status] || STATUS_MAP.pending;
      return { ...o.toJSON(), statusText: s.text, statusType: s.type };
    });
    res.json({ code: 0, data: { list, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err) {
    console.error('[Order] adminList error:', err.message);
    res.status(500).json({ code: 500, message: '获取订单列表失败' });
  }
};

exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !STATUS_MAP[status]) {
      return res.status(400).json({ code: 400, message: '无效状态' });
    }
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ code: 404, message: '订单不存在' });
    order.status = status;
    await order.save();
    const s = STATUS_MAP[order.status];
    res.json({ code: 0, data: { ...order.toJSON(), statusText: s.text, statusType: s.type } });
  } catch (err) {
    console.error('[Order] adminUpdateStatus error:', err.message);
    res.status(500).json({ code: 500, message: '更新状态失败' });
  }
};

exports.adminStats = async (req, res) => {
  try {
    const total = await Order.count();
    const pending = await Order.count({ where: { status: 'pending' } });
    const processing = await Order.count({ where: { status: 'processing' } });
    const completed = await Order.count({ where: { status: 'completed' } });
    const cancelled = await Order.count({ where: { status: 'cancelled' } });
    res.json({ code: 0, data: { total, pending, processing, completed, cancelled } });
  } catch (err) {
    console.error('[Order] adminStats error:', err.message);
    res.status(500).json({ code: 500, message: '获取统计失败' });
  }
};
