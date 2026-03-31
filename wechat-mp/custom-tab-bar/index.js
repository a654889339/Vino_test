const i18n = require('../utils/i18n.js');

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', textEn: 'Home', normal: '/images/icons/tab-home.svg', active: '/images/icons/tab-home-active.svg' },
      { pagePath: '/pages/products/products', text: '产品', textEn: 'Products', normal: '/images/icons/tab-label.svg', active: '/images/icons/tab-label-active.svg' },
      { pagePath: '/pages/service/service', text: '服务', textEn: 'Services', normal: '/images/icons/tab-apps.svg', active: '/images/icons/tab-apps-active.svg' },
      { pagePath: '/pages/mine/mine', text: '我的', textEn: 'Mine', normal: '/images/icons/tab-user.svg', active: '/images/icons/tab-user-active.svg' },
    ],
  },
  lifetimes: {
    attached() {
      this.refreshLabels();
    },
  },
  pageLifetimes: {
    show() {
      this.refreshLabels();
    },
  },
  methods: {
    refreshLabels() {
      const list = this.data.list.map(item => ({
        ...item,
        label: i18n.pick(item, 'text'),
      }));
      this.setData({ list });
    },
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({
        url: this.data.list[index].pagePath,
      });
      this.setData({ selected: index });
    },
  },
});
