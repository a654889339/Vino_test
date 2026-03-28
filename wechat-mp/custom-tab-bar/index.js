Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', normal: '/images/icons/tab-home.svg', active: '/images/icons/tab-home-active.svg' },
      { pagePath: '/pages/products/products', text: '产品', normal: '/images/icons/tab-label.svg', active: '/images/icons/tab-label-active.svg' },
      { pagePath: '/pages/service/service', text: '服务', normal: '/images/icons/tab-apps.svg', active: '/images/icons/tab-apps-active.svg' },
      { pagePath: '/pages/mine/mine', text: '我的', normal: '/images/icons/tab-user.svg', active: '/images/icons/tab-user-active.svg' },
    ],
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      wx.switchTab({
        url: this.data.list[index].pagePath,
      });
      this.setData({ selected: index });
    },
  },
});
