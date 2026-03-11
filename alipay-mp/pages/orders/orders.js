const app = getApp();

const statusMap = {
  pending: { text: '待支付', type: 'warning' },
  processing: { text: '进行中', type: 'primary' },
  completed: { text: '已完成', type: 'success' },
  cancelled: { text: '已取消', type: 'default' },
};

Page({
  data: {
    isLoggedIn: false,
    activeTab: 0,
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'pending', name: '待支付' },
      { key: 'processing', name: '进行中' },
      { key: 'completed', name: '已完成' },
    ],
    orders: [],
    loading: true,
    statusMap,
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().then(() => {
      my.stopPullDownRefresh();
    });
  },

  loadOrders() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn });
    if (!isLoggedIn) {
      this.setData({ orders: [], loading: false });
      return Promise.resolve();
    }
    const status = this.data.tabs[this.data.activeTab].key;
    const url = status === 'all' ? '/orders/mine' : `/orders/mine?status=${status}`;
    this.setData({ loading: true });
    return app
      .request({ url })
      .then(res => {
        const data = (res.data || []).map(o => ({
          ...o,
          statusText: (statusMap[o.status] || {}).text || o.status,
          statusType: (statusMap[o.status] || {}).type || 'default',
          timeText: this.formatTime(o.createdAt),
        }));
        this.setData({ orders: data, loading: false });
      })
      .catch(err => {
        this.setData({ loading: false, orders: [] });
        if (err.message === '请先登录') {
          my.showToast({ content: '请先登录', type: 'none' });
        }
      });
  },

  switchTab(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    this.setData({ activeTab: index });
    this.loadOrders();
  },

  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    my.confirm({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: res => {
        if (res.confirm) {
          app
            .request({ method: 'PUT', url: `/orders/${id}/cancel` })
            .then(() => {
              my.showToast({ content: '订单已取消', type: 'success' });
              this.loadOrders();
            })
            .catch(err => {
              my.showToast({ content: err.message || '取消失败', type: 'none' });
            });
        }
      },
    });
  },
});
