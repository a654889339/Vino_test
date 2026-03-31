const i18n = require('../../utils/i18n.js');

Page({
  data: { url: '' },
  onLoad(options) {
    let url = decodeURIComponent(options.url || '');
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    this.setData({ url });
    const setTitle = () => {
      wx.setNavigationBarTitle({ title: i18n.t('webview.aboutVino') });
    };
    if (i18n.isLoaded()) {
      setTitle();
    } else {
      i18n.loadI18nTexts(setTitle);
    }
  },
});
