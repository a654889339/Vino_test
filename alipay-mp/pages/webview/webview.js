Page({
  data: { url: '' },
  onLoad(query) {
    let url = decodeURIComponent(query.url || '');
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    this.setData({ url });
  },
});
