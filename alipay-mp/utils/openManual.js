/**
 * PDF：my.downloadFile + my.openDocument；否则 webview。
 * 下载域名需在支付宝小程序后台配置合法域名。
 */
const { toFullUrl, isLikelyPdfUrl } = require('./manualUrl.js');

function openManual(rawUrl, app) {
  const url = toFullUrl(rawUrl, app);
  if (!url) return;

  if (isLikelyPdfUrl(url)) {
    my.showLoading({ content: 'PDF加载中...' });
    my.downloadFile({
      url,
      success(res) {
        my.hideLoading();
        const p = res.apFilePath || res.tempFilePath;
        if (p) {
          my.openDocument({
            filePath: p,
            fileType: 'pdf',
            fail() {
              my.showToast({ content: '无法打开PDF', type: 'none' });
            },
          });
        } else {
          my.showToast({ content: '下载失败', type: 'none' });
        }
      },
      fail() {
        my.hideLoading();
        my.showToast({ content: '下载失败', type: 'none' });
      },
    });
    return;
  }

  my.navigateTo({
    url: '/pages/webview/webview?url=' + encodeURIComponent(url),
  });
}

/** 米家式：仅 PDF 且无 helpItems 时列表点击直接打开文档 */
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
