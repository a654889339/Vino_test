const app = getApp();

Page({
  data: { addresses: [], loading: false },

  onShow() { this.loadAddresses(); },

  loadAddresses() {
    this.setData({ loading: true });
    app.request({ url: '/address' })
      .then(res => {
        const list = (res.data || []).map(a => ({
          ...a,
          fullAddress: [a.country === '其他' ? a.customCountry : a.country, a.province, a.city, a.district, a.detailAddress].filter(Boolean).join(' '),
        }));
        this.setData({ addresses: list, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  addAddr() { my.navigateTo({ url: '/pages/address-edit/address-edit' }); },
  editAddr(e) { my.navigateTo({ url: '/pages/address-edit/address-edit?id=' + e.currentTarget.dataset.id }); },

  setDefault(e) {
    app.request({ url: '/address/' + e.currentTarget.dataset.id + '/default', method: 'PUT' })
      .then(() => this.loadAddresses())
      .catch(() => my.showToast({ content: '操作失败' }));
  },

  deleteAddr(e) {
    my.confirm({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      confirmButtonText: '删除',
      success: res => {
        if (res.confirm) {
          app.request({ url: '/address/' + e.currentTarget.dataset.id, method: 'DELETE' })
            .then(() => this.loadAddresses())
            .catch(() => my.showToast({ content: '删除失败' }));
        }
      },
    });
  },
});
