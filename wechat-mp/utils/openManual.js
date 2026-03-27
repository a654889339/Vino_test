/**
 * 米家同款思路：PDF 先用 wx.downloadFile 拉临时文件，再 wx.openDocument 全屏预览（含「文件预览」标题栏）；
 * 非 PDF 链接走 webview。
 * ① 列表「电子说明书」：仅 PDF 且无 HTML 章节时由 openManualFromGuide 直接打开，不进中间页。
 * ② 说明书页底部按钮：始终走 openManual。
 * downloadFile 域名须在微信公众平台「下载文件合法域名」中配置。
 */
const { toFullUrl, isLikelyPdfUrl } = require('./manualUrl.js');

function openManual(rawUrl, app) {
  const url = toFullUrl(rawUrl, app);
  if (!url) return;

  if (isLikelyPdfUrl(url)) {
    wx.showLoading({ title: 'PDF加载中...', mask: true });
    wx.downloadFile({
      url,
      success(res) {
        wx.hideLoading();
        if (res.statusCode === 200 && res.tempFilePath) {
          wx.openDocument({
            filePath: res.tempFilePath,
            fileType: 'pdf',
            showMenu: true,
            fail() {
              wx.showToast({ title: '无法打开PDF', icon: 'none' });
            },
          });
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      },
      fail() {
        wx.hideLoading();
        wx.showToast({ title: '下载失败', icon: 'none' });
      },
    });
    return;
  }

  wx.navigateTo({
    url: '/pages/webview/webview?url=' + encodeURIComponent(url),
  });
}

/**
 * 米家式：仅配置了 PDF 直链且无 HTML 章节（helpItems 为空）时，列表点击即走
 * downloadFile + openDocument，不进入说明书中间页。
 * @returns {boolean} 是否已处理（true 则无需再 navigateTo manual 页）
 */
function openManualFromGuide(guide, helpItems, app) {
  const raw = guide && guide.manualPdfUrl ? String(guide.manualPdfUrl).trim() : '';
  const help = helpItems || [];
  if (!raw || help.length > 0) return false;
  const full = toFullUrl(raw, app);
  if (!isLikelyPdfUrl(full)) return false;
  openManual(raw, app);
  return true;
}

module.exports = { openManual, openManualFromGuide };
