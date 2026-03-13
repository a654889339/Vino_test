const app = getApp();

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

Page({
  data: {
    list: [],
    loading: true,
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    if (!app.isLoggedIn()) {
      this.setData({ list: [], loading: false });
      return;
    }
    this.setData({ loading: true });
    app.request({ url: '/auth/my-products' })
      .then(res => {
        const list = (res.data || []).map(item => ({
          ...item,
          boundAtStr: formatTime(item.boundAt),
        }));
        this.setData({ list, loading: false });
      })
      .catch(() => this.setData({ list: [], loading: false }));
  },
});
