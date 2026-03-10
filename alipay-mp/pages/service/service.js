const allServices = {
  repair: [
    { id: 1, title: '设备维修', desc: '专业工程师', emoji: '🔧', price: '99', bg: '#B91C1C' },
    { id: 2, title: '上门维修', desc: '快速响应', emoji: '🏠', price: '149', bg: '#DC2626' },
    { id: 3, title: '远程支持', desc: '在线指导', emoji: '📞', price: '29', bg: '#EF4444' },
  ],
  clean: [
    { id: 4, title: '深度清洁', desc: '全方位保养', emoji: '✨', price: '149', bg: '#2563EB' },
    { id: 5, title: '日常清洁', desc: '基础维护', emoji: '🧹', price: '69', bg: '#3B82F6' },
  ],
  inspect: [
    { id: 6, title: '全面检测', desc: '系统评估', emoji: '🔍', price: '49', bg: '#059669' },
    { id: 7, title: '性能优化', desc: '提速升级', emoji: '🚀', price: '79', bg: '#10B981' },
  ],
  data: [
    { id: 8, title: '数据恢复', desc: '专业找回', emoji: '💾', price: '199', bg: '#7C3AED' },
    { id: 9, title: '数据备份', desc: '安全迁移', emoji: '📁', price: '59', bg: '#8B5CF6' },
  ],
};

Page({
  data: {
    activeTab: 0,
    tabs: [
      { key: 'repair', name: '维修' },
      { key: 'clean', name: '清洁' },
      { key: 'inspect', name: '检测' },
      { key: 'data', name: '数据' },
    ],
    currentServices: allServices.repair,
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const key = this.data.tabs[index].key;
    this.setData({
      activeTab: index,
      currentServices: allServices[key],
    });
  },
});
