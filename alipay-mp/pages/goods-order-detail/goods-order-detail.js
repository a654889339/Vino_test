const app = getApp();
const i18n = require('../../utils/i18n.js');
const currencyUtil = require('../../utils/currency.js');
const { resolveMediaUrl } = require('../../utils/cosMedia.js');

function formatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function itemDisplayImageUrl(it, baseUrl) {
  const raw = (it && (it.imageUrl || it.imageURL) ? String(it.imageUrl || it.imageURL) : '').trim();
  if (!raw) return '';
  return resolveMediaUrl(raw, baseUrl);
}

function orderStatusText(status) {
  const map = {
    pending: '待付款',
    paid: '已付款',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return map[status] || status;
}

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    order: null,
    i18n: { loading: '' },
  },

  onShow() {
    const self = this;
    const doRefresh = () => {
      self.setData({ i18n: { loading: i18n.t('common.loading') } });
      self.load();
    };
    if (i18n.isLoaded()) doRefresh();
    else i18n.loadI18nTexts(doRefresh);
  },

  load() {
    const isLoggedIn = app.isLoggedIn();
    this.setData({ isLoggedIn, loading: true });
    if (!isLoggedIn) {
      this.setData({ loading: false, order: null });
      return;
    }
    const id = this.options && this.options.id ? this.options.id : '';
    if (!id) {
      this.setData({ loading: false, order: null });
      return;
    }
    app.request({ url: '/goods-orders/' + encodeURIComponent(String(id)) })
      .then((res) => {
        const o = res.data || null;
        if (!o) {
          this.setData({ order: null, loading: false });
          return;
        }
        const sym = app.globalData.currencySymbol;
        const baseUrl = app.globalData.baseUrl || '';
        const items = (o.items || []).map((it) => ({
          ...it,
          displayImageUrl: itemDisplayImageUrl(it, baseUrl),
          unitText: currencyUtil.formatPriceDisplay(it.unitPrice, it.currency || sym) || '—',
          lineText: currencyUtil.formatPriceDisplay(it.lineTotal, it.currency || sym) || '—',
        }));
        this.setData({
          order: {
            ...o,
            timeText: formatTime(o.createdAt),
            totalText: currencyUtil.formatPriceDisplay(o.totalPrice, o.currency || sym) || '—',
            statusText: orderStatusText(o.status),
            statusClass: o.status,
            items,
          },
          loading: false,
        });
      })
      .catch(() => this.setData({ order: null, loading: false }));
  },

  cancelOrder() {
    const order = this.data.order;
    if (!order || !order.id) return;
    const id = order.id;
    my.confirm({
      title: '取消订单',
      content: '确定取消？商品将返回购物车。',
      confirmButtonText: '确定',
      cancelButtonText: '关闭',
      success: (res) => {
        if (!res.confirm) return;
        app
          .request({ url: '/goods-orders/' + id + '/cancel', method: 'POST' })
          .then((body) => {
            my.showToast({ type: 'success', content: (body && body.message) || '已取消' });
            this.load();
          })
          .catch((err) => {
            my.showToast({ type: 'fail', content: (err && err.message) || '取消失败' });
          });
      },
    });
  },
});
