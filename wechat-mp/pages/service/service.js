const app = getApp();

Page({
  data: {
    categories: [],
    loading: true,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadServices();
  },

  loadServices() {
    this.setData({ loading: true });
    app.request({ url: '/services' })
      .then(res => {
        const services = (res.data && res.data.list) || res.data || [];
        if (services.length) {
          const catMap = {};
          const catOrder = [];
          services.forEach(s => {
            const cat = s.serviceCategory || s.category || {};
            const catKey = cat.key || cat.id || 'other';
            const catName = cat.name || (typeof s.category === 'string' ? s.category : '其他');
            if (!catMap[catKey]) {
              catMap[catKey] = { key: String(catKey), name: catName, items: [] };
              catOrder.push(catKey);
            }
            catMap[catKey].items.push({
              id: s.id,
              title: s.title || '服务',
              icon: s.icon || 'setting-o',
              iconUrl: s.iconUrl || '',
              emoji: '🔧',
            });
          });
          const cats = catOrder.map(k => catMap[k]);
          this.setData({ categories: cats, loading: false });
        } else {
          this.setData({ categories: this.getFallbackCategories(), loading: false });
        }
      })
      .catch(() => {
        this.setData({ categories: this.getFallbackCategories(), loading: false });
      });
  },

  getFallbackCategories() {
    return [
      { key: 'repair', name: '售后维修', items: [
        { id: 1, title: '设备维修', emoji: '🔧', icon: '', iconUrl: '' },
        { id: 2, title: '上门维修', emoji: '🏠', icon: '', iconUrl: '' },
        { id: 3, title: '远程支持', emoji: '📞', icon: '', iconUrl: '' },
      ]},
      { key: 'clean', name: '清洁维养', items: [
        { id: 4, title: '深度清洁', emoji: '✨', icon: '', iconUrl: '' },
        { id: 5, title: '日常清洁', emoji: '🧹', icon: '', iconUrl: '' },
      ]},
      { key: 'inspect', name: '检测', items: [
        { id: 6, title: '全面检测', emoji: '🔍', icon: '', iconUrl: '' },
        { id: 7, title: '性能优化', emoji: '🚀', icon: '', iconUrl: '' },
      ]},
      { key: 'data', name: '数据', items: [
        { id: 8, title: '数据恢复', emoji: '💾', icon: '', iconUrl: '' },
        { id: 9, title: '数据备份', emoji: '📁', icon: '', iconUrl: '' },
      ]},
    ];
  },

  goServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/service-detail/service-detail?id=' + id });
  },
});
