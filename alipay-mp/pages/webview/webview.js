Page({
  data: { url: '' },
  onLoad(query) {
    const url = decodeURIComponent(query.url || '');
    this.setData({ url });
  },
});
