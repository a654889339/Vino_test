const app = getApp();
const i18n = require('../../utils/i18n.js');

const GOODS_ORDER_STAT_GROUPS = {
  pendingPay: ['pending'],
  pendingShipment: ['paid'],
  pendingReceipt: ['processing'],
  pendingReview: ['completed'],
  afterSales: ['after_sale', 'after-sales', 'refund', 'refunding', 'refunded'],
};

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    avatarInitial: 'V',
    avatarUrl: '',
    maskedPhone: '',
    isEn: false,
    stats: [
      { key: 'pendingPay', label: '待付款', value: 0, iconClass: 'icon-balance-pay' },
      { key: 'pendingShipment', label: '待发货', value: 0, iconClass: 'icon-logistics' },
      { key: 'pendingReceipt', label: '待收货', value: 0, iconClass: 'icon-completed' },
      { key: 'pendingReview', label: '待评价', value: 0, iconClass: 'icon-comment' },
      { key: 'afterSales', label: '退款/售后', value: 0, iconClass: 'icon-replay' },
    ],
    i18n: {
      myOrders: '我的订单',
      viewEditProfile: '查看/编辑资料',
      points: '积分',
      coupons: '购物券',
      wallet: '钱包',
      viewAllOrders: '查看全部订单',
      myCart: '我的购物车',
      view: '查看',
      total: '共',
      itemUnit: '件',
      cartEmpty: '购物车是空的',
    },
    cartPreviewItems: [],
    cartTotalCount: 0,
    menus: [
      { title: '服务订单', emoji: '📋', url: '/pages/orders/orders' },
      { title: '我的商品', emoji: '📦', url: '/pages/my-products/my-products' },
      { title: '地址管理', emoji: '📍', url: '/pages/address/address' },
      { title: '意见反馈', emoji: '💬', url: '', chat: true },
      { title: '关于Vino', emoji: 'ℹ️', url: '', webUrl: 'www.vinotech.cn' },
      { title: '联系我们', emoji: '📞', url: '', contact: true },
    ],
  },

  onShow() {
    i18n.applyTabBarLabels();
    const refresh = () => {
      i18n.setNavTitle('mine.title');
      this.refreshTexts();
      this.checkLoginState();
    };
    if (i18n.isLoaded()) refresh(); else i18n.loadI18nTexts(refresh);
  },

  refreshTexts() {
    const vals = {};
    this.data.stats.forEach(s => { vals[s.key] = s.value; });
    this.setData({
      isEn: i18n.isEn(),
      i18n: {
        myOrders: i18n.t('我的订单', 'My Orders'),
        viewEditProfile: i18n.t('查看/编辑资料', 'View / Edit Profile'),
        points: i18n.t('积分', 'Points'),
        coupons: i18n.t('购物券', 'Coupons'),
        wallet: i18n.t('钱包', 'Wallet'),
        viewAllOrders: i18n.t('查看全部订单', 'View All'),
        myCart: i18n.t('我的购物车', 'My Cart'),
        view: i18n.t('查看', 'View'),
        total: i18n.t('共', 'Total'),
        itemUnit: i18n.t('件', 'items'),
        cartEmpty: i18n.t('购物车是空的', 'Cart is empty'),
      },
      stats: [
        { key: 'pendingPay', label: i18n.t('待付款', 'Pending'), value: vals.pendingPay || 0, iconClass: 'icon-balance-pay' },
        { key: 'pendingShipment', label: i18n.t('待发货', 'To Ship'), value: vals.pendingShipment || 0, iconClass: 'icon-logistics' },
        { key: 'pendingReceipt', label: i18n.t('待收货', 'To Receive'), value: vals.pendingReceipt || 0, iconClass: 'icon-completed' },
        { key: 'pendingReview', label: i18n.t('待评价', 'To Review'), value: vals.pendingReview || 0, iconClass: 'icon-comment' },
        { key: 'afterSales', label: i18n.t('退款/售后', 'Refund/After-sales'), value: vals.afterSales || 0, iconClass: 'icon-replay' },
      ],
    });
  },

  checkLoginState() {
    const isLoggedIn = app.isLoggedIn();
    if (isLoggedIn && !app.globalData.userInfo) {
      app
        .request({ url: '/auth/profile' })
        .then(res => {
          const user = res.data || {};
          app.globalData.userInfo = user;
          this.applyUserData(user);
          this.loadGoodsOrderStats();
          this.loadCartSummary();
        })
        .catch(() => {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          this.resetGoodsOrderStats();
          this.resetCartSummary();
        });
    } else {
      const user = app.globalData.userInfo || null;
      if (user) {
        this.applyUserData(user);
        this.loadGoodsOrderStats();
        this.loadCartSummary();
      } else {
        this.setData({ userInfo: null, isLoggedIn: isLoggedIn, avatarUrl: '', avatarInitial: 'V' });
        this.resetGoodsOrderStats();
        this.resetCartSummary();
      }
    }
  },

  applyUserData(user) {
    const initial = (user.nickname || user.username || 'V').charAt(0);
    const avatarUrl = user.avatar || '';
    const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({ userInfo: user, isLoggedIn: true, avatarInitial: initial, avatarUrl, maskedPhone });
  },

  resetGoodsOrderStats() {
    this.setGoodsOrderStats({
      pendingPay: 0,
      pendingShipment: 0,
      pendingReceipt: 0,
      pendingReview: 0,
      afterSales: 0,
    });
  },

  setGoodsOrderStats(values) {
    this.setData({
      stats: [
        { key: 'pendingPay', label: i18n.t('待付款', 'Pending') || '待付款', value: values.pendingPay || 0, iconClass: 'icon-balance-pay' },
        { key: 'pendingShipment', label: i18n.t('待发货', 'To Ship') || '待发货', value: values.pendingShipment || 0, iconClass: 'icon-logistics' },
        { key: 'pendingReceipt', label: i18n.t('待收货', 'To Receive') || '待收货', value: values.pendingReceipt || 0, iconClass: 'icon-completed' },
        { key: 'pendingReview', label: i18n.t('待评价', 'To Review') || '待评价', value: values.pendingReview || 0, iconClass: 'icon-comment' },
        { key: 'afterSales', label: i18n.t('退款/售后', 'Refund/After-sales') || '退款/售后', value: values.afterSales || 0, iconClass: 'icon-replay' },
      ],
    });
  },

  loadGoodsOrderStats() {
    if (!app.isLoggedIn()) {
      this.resetGoodsOrderStats();
      return;
    }
    const tasks = Object.keys(GOODS_ORDER_STAT_GROUPS).map((key) => {
      const statuses = GOODS_ORDER_STAT_GROUPS[key];
      return Promise.all(statuses.map((status) => app.request({
        url: '/goods-orders',
        data: { status, page: 1, pageSize: 1 },
      }).then(res => Number((res.data && res.data.total) || 0)).catch(() => 0)))
        .then(totals => ({ key, value: totals.reduce((sum, n) => sum + n, 0) }));
    });
    Promise.all(tasks)
      .then((items) => {
        const values = {};
        items.forEach(item => { values[item.key] = item.value; });
        this.setGoodsOrderStats(values);
      })
      .catch(() => this.resetGoodsOrderStats());
  },

  resetCartSummary() {
    this.setData({ cartPreviewItems: [], cartTotalCount: 0 });
  },

  loadCartSummary() {
    if (!app.isLoggedIn()) {
      this.resetCartSummary();
      return;
    }
    app.request({ url: '/cart' })
      .then((res) => {
        const d = res.data || {};
        const items = (d.items || []).slice(0, 3).map((x) => ({
          ...x,
          imageUrl: x.imageUrl ? (String(x.imageUrl).startsWith('http') ? x.imageUrl : app.globalData.baseUrl.replace('/api', '') + x.imageUrl) : '',
        }));
        const total = Number(d.totalCount || (d.items || []).reduce((sum, x) => sum + (Number(x.qty) || 0), 0));
        this.setData({ cartPreviewItems: items, cartTotalCount: total });
      })
      .catch(() => this.resetCartSummary());
  },

  onProfileTap() {
    if (!app.isLoggedIn()) {
      my.navigateTo({ url: '/pages/login/login' });
    } else {
      my.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onLangTap() {
    i18n.setLang(i18n.isEn() ? 'zh' : 'en');
    this.refreshTexts();
  },

  onStatTap(e) {
    const statusGroup = e.currentTarget.dataset.statusGroup || '';
    my.navigateTo({
      url: '/pages/goods-orders/goods-orders?statusGroup=' + encodeURIComponent(statusGroup),
    });
  },

  onAllGoodsOrdersTap() {
    my.navigateTo({ url: '/pages/goods-orders/goods-orders' });
  },

  onCartTap() {
    my.navigateTo({ url: '/pages/cart/cart' });
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      my.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      my.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.contact) {
      my.confirm({
        title: '联系我们',
        content: '客服电话：400-8030-683',
        cancelButtonText: '复制',
        confirmButtonText: '立刻拨打',
        success: (res) => {
          if (res.confirm) {
            my.makePhoneCall({ number: '4008030683' });
          } else {
            my.setClipboard({ text: '400-8030-683' });
            my.showToast({ content: '已复制', type: 'success' });
          }
        },
      });
    } else if (item.url) {
      my.navigateTo({ url: item.url, fail() { my.switchTab({ url: item.url }); } });
    } else {
      my.showToast({ content: '功能开发中', type: 'none' });
    }
  },

  logout() {
    my.confirm({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          this.resetGoodsOrderStats();
          this.resetCartSummary();
          my.showToast({ content: '已退出', type: 'success' });
        }
      },
    });
  },
});
