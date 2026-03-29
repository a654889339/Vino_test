/** 上报当前小程序页面访问（app=mp） */
function trackCurrentPage() {
  try {
    const app = getApp();
    if (!app || !app.globalData || !app.globalData.baseUrl) return;
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    if (!cur) return;
    const route = cur.route || '';
    const path = '/' + route;
    wx.request({
      url: app.globalData.baseUrl + '/analytics/page-view',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { path, app: 'mp' },
      fail: function () {},
    });
  } catch (_) {}
}

module.exports = { trackCurrentPage };
