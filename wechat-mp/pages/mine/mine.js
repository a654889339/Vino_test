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
    stats: [],
    cartPreviewItems: [],
    cartTotalCount: 0,
    menus: [],
    i18n: {},
  },

  onShow() {
    i18n.syncCustomTabBar(this, 3);
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.checkLoginState();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('mine.title');
    const vals = {};
    this.data.stats.forEach(s => { vals[s.key] = s.value; });
    this.setData({
      isEn: i18n.isEn(),
      i18n: {
        user: i18n.t('mine.user'),
        tapLogin: i18n.t('mine.tapLogin'),
        loginBenefits: i18n.t('mine.loginBenefits'),
        logout: i18n.t('mine.logout'),
        viewEditProfile: i18n.t('查看/编辑资料', 'View / Edit Profile'),
        points: i18n.t('积分', 'Points'),
        coupons: i18n.t('购物券', 'Coupons'),
        wallet: i18n.t('钱包', 'Wallet'),
        myOrders: i18n.t('我的订单', 'My Orders'),
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
      menus: [
        { title: '服务订单', icon: '/images/icons/mine-orders.svg', url: '/pages/orders/orders' },
        { title: i18n.t('mine.products'), icon: '/images/icons/mine-bag.svg', url: '/pages/my-products/my-products' },
        { title: i18n.t('mine.address'), icon: '/images/icons/mine-location.svg', url: '/pages/address/address' },
        { title: i18n.t('mine.feedback'), icon: '/images/icons/mine-comment.svg', url: '', chat: true },
        { title: i18n.t('mine.about'), icon: '/images/icons/mine-info.svg', url: '', webUrl: 'www.vinotech.cn' },
        { title: i18n.t('mine.contact'), icon: '/images/icons/mine-phone.svg', url: '', contact: true },
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
    const labels = {
      pendingPay: i18n.t('待付款', 'Pending') || '待付款',
      pendingShipment: i18n.t('待发货', 'To Ship') || '待发货',
      pendingReceipt: i18n.t('待收货', 'To Receive') || '待收货',
      pendingReview: i18n.t('待评价', 'To Review') || '待评价',
      afterSales: i18n.t('退款/售后', 'Refund/After-sales') || '退款/售后',
    };
    this.setData({
      stats: [
        { key: 'pendingPay', label: labels.pendingPay, value: values.pendingPay || 0, iconClass: 'icon-balance-pay' },
        { key: 'pendingShipment', label: labels.pendingShipment, value: values.pendingShipment || 0, iconClass: 'icon-logistics' },
        { key: 'pendingReceipt', label: labels.pendingReceipt, value: values.pendingReceipt || 0, iconClass: 'icon-completed' },
        { key: 'pendingReview', label: labels.pendingReview, value: values.pendingReview || 0, iconClass: 'icon-comment' },
        { key: 'afterSales', label: labels.afterSales, value: values.afterSales || 0, iconClass: 'icon-replay' },
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
      wx.navigateTo({ url: '/pages/login/login' });
    } else {
      wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
    }
  },

  onLangTap() {
    i18n.setLang(i18n.isEn() ? 'zh' : 'en');
    this.refreshI18n();
  },

  onStatTap(e) {
    const statusGroup = e.currentTarget.dataset.statusGroup || '';
    wx.navigateTo({
      url: '/pages/goods-orders/goods-orders?statusGroup=' + encodeURIComponent(statusGroup),
    });
  },

  onAllGoodsOrdersTap() {
    wx.navigateTo({ url: '/pages/goods-orders/goods-orders' });
  },

  onCartTap() {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  onMenuTap(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    const item = this.data.menus[idx] || {};
    if (item.chat) {
      wx.navigateTo({ url: '/pages/chat/chat' });
    } else if (item.webUrl) {
      wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(item.webUrl) });
    } else if (item.contact) {
      wx.showModal({
        title: i18n.t('mine.contactTitle'),
        content: i18n.t('mine.contactPhone'),
        cancelText: i18n.t('mine.copy'),
        confirmText: i18n.t('mine.callNow'),
        success: (res) => {
          if (res.confirm) {
            wx.makePhoneCall({ phoneNumber: '4008030683' });
          } else {
            wx.setClipboardData({ data: '400-8030-683', success: () => wx.showToast({ title: i18n.t('mine.copied') }) });
          }
        },
      });
    } else if (item.url) {
      wx.navigateTo({ url: item.url, fail() { wx.switchTab({ url: item.url }); } });
    } else {
      wx.showToast({ title: i18n.t('mine.comingSoon'), icon: 'none' });
    }
  },

  logout() {
    wx.showModal({
      title: i18n.t('mine.logout'),
      content: i18n.t('mine.logoutConfirm'),
      success: res => {
        if (res.confirm) {
          app.clearToken();
          this.setData({ userInfo: null, isLoggedIn: false, avatarUrl: '', avatarInitial: 'V' });
          this.resetGoodsOrderStats();
          this.resetCartSummary();
          wx.showToast({ title: i18n.t('mine.loggedOut'), icon: 'success' });
        }
      },
    });
  },
});
