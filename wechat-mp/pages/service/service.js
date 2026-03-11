const app = getApp();

const fallbackGuides = [
  { id: 1, name: '空调', model: '家用/商用中央空调', emoji: '❄️', gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)', badge: '热门' },
  { id: 2, name: '除湿机', model: '家用/工业除湿设备', emoji: '💧', gradient: 'linear-gradient(135deg, #0891B2, #67E8F9)', badge: '' },
  { id: 3, name: '光储一体机', model: '户用光储一体化系统', emoji: '☀️', gradient: 'linear-gradient(135deg, #D97706, #FBBF24)', badge: '新' },
  { id: 4, name: '光伏变电器', model: '汇流箱/变压器/配电柜', emoji: '⚡', gradient: 'linear-gradient(135deg, #059669, #34D399)', badge: '' },
  { id: 5, name: '逆变器', model: '组串式/集中式/微型逆变器', emoji: '🔌', gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)', badge: '' },
];

Page({
  data: {
    activeTab: 0,
    tabs: [
      { key: 'repair', name: '维修' },
      { key: 'clean', name: '清洁' },
      { key: 'inspect', name: '检测' },
      { key: 'data', name: '数据' },
    ],
    deviceGuides: fallbackGuides,
    services: [],
    loading: true,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadGuides();
    this.loadServices();
  },

  loadGuides() {
    app.request({ url: '/guides' })
      .then(res => {
        const list = res.data || [];
        if (list.length) {
          this.setData({ deviceGuides: list.map(g => ({
            id: g.id, name: g.name, model: g.subtitle || '', emoji: g.emoji || '',
            gradient: g.gradient || '', badge: g.badge || '',
            tags: typeof g.tags === 'string' ? JSON.parse(g.tags || '[]') : (g.tags || []),
            sections: typeof g.sections === 'string' ? JSON.parse(g.sections || '[]') : (g.sections || []),
          }))});
        }
      })
      .catch(() => {});
  },

  loadServices() {
    const tabs = this.data.tabs;
    const tab = tabs[this.data.activeTab] || tabs[0];
    const key = tab.key;
    const categoryNames = { repair: '维修', clean: '清洁', inspect: '检测', data: '数据' };
    const category = categoryNames[key] || '维修';
    this.setData({ loading: true });
    app.request({ url: `/services?category=${encodeURIComponent(category)}` })
      .then(res => {
        const data = (res.data || []).map(s => ({
          id: s.id,
          title: s.title || '服务',
          desc: s.description || '专业服务',
          price: s.price || 0,
          emoji: '🔧',
          bg: '#B91C1C',
        }));
        this.setData({ services: data.length ? data : this.getFallbackServices(key), loading: false });
      })
      .catch(() => {
        this.setData({ services: this.getFallbackServices(key), loading: false });
      });
  },

  getFallbackServices(key) {
    const all = {
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
    return all[key] || all.repair;
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
    this.loadServices();
  },

  goServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/service-detail/service-detail?id=${id}` });
  },

  showGuide(e) {
    const device = e.currentTarget.dataset.device;
    let content = device.model + '\n';
    const sections = device.sections || [];
    if (sections.length) {
      sections.forEach(sec => {
        content += '\n【' + sec.title + '】\n';
        (sec.tips || []).forEach(t => { content += '· ' + t + '\n'; });
      });
    } else {
      content += '\n设备服务指南，详情请咨询客服。';
    }
    wx.showModal({ title: device.name, content, showCancel: false });
  },
});
