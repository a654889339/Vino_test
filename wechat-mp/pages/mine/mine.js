Page({
  data: {
    userInfo: {},
    stats: [
      { label: '待支付', value: 0 },
      { label: '进行中', value: 0 },
      { label: '待评价', value: 0 },
      { label: '售后', value: 0 },
    ],
    menus: [
      { title: '我的订单', emoji: '📋' },
      { title: '我的收藏', emoji: '⭐' },
      { title: '地址管理', emoji: '📍' },
      { title: '优惠券', emoji: '🎫' },
      { title: '帮助中心', emoji: '❓' },
      { title: '意见反馈', emoji: '💬' },
      { title: '关于Vino', emoji: 'ℹ️' },
    ],
  },
});
