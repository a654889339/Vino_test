/** 解析 JWT 过期时间（毫秒），失败返回 null */
function getJwtExpMs(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const buf = wx.base64ToArrayBuffer(b64);
    const arr = new Uint8Array(buf);
    let str = '';
    for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
    const payload = JSON.parse(str);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch (e) {
    return null;
  }
}

const currencyUtil = require('./utils/currency.js');
const i18n = require('./utils/i18n.js');
const { BASE_URL } = require('./config.js');

/** 检测明显错误的 API 根地址，避免只看到「连接被拒绝 / 域名无法解析」 */
function warnIfBadApiBase(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') return;
  const u = baseUrl.toLowerCase();
  const bad =
    /\.example\.(com|net|org)\b/.test(u) ||
    (u.includes('localhost') && u.includes(':5502'));
  if (!bad) return;
  try {
    wx.showModal({
      title: 'API 地址配置异常',
      content:
        '当前 baseUrl 指向无效或易错地址（如 example.com、错误端口）。请打开项目根目录下的 config.js，将 BASE_URL 改为真实后端，例如：http://106.54.50.88:5202/api',
      showCancel: false,
    });
  } catch (e) {}
}

App({
  globalData: {
    // 唯一主源：config.js。禁止在其它地方硬编码后端地址兜底。
    baseUrl: BASE_URL,
    userInfo: null,
    token: '',
    currencySymbol: currencyUtil.DEFAULT_CURRENCY,
    featureFlags: null,
  },

  loadCurrencySymbol() {
    const app = this;
    wx.request({
      url: app.globalData.baseUrl + '/home-config?section=currency',
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode !== 200 || !res.data || res.data.code !== 0) return;
        const list = res.data.data || [];
        const row = list.find((i) => i.section === 'currency' && i.status === 'active');
        const sym = row && row.title ? String(row.title).trim() : '';
        app.globalData.currencySymbol = sym || currencyUtil.DEFAULT_CURRENCY;
      },
    });
  },

  onLaunch() {
    warnIfBadApiBase(this.globalData.baseUrl);
    this.checkAppStatus();
    this.loadCurrencySymbol();
    i18n.loadI18nTexts();
    const token = wx.getStorageSync('vino_token');
    if (token) {
      const expMs = getJwtExpMs(token);
      if (expMs != null && Date.now() >= expMs) {
        this.clearToken();
        return;
      }
      this.globalData.token = token;
      this.fetchProfile();
    }
  },

  checkAppStatus() {
    const app = this;
    const { baseUrl } = app.globalData;
    wx.request({
      url: baseUrl + '/app/status',
      method: 'GET',
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode !== 200 || !res.data || res.data.code !== 0) return;
        const d = res.data.data || null;
        app.globalData.featureFlags = d;
        if (d && d.maintenanceMode) {
          try {
            wx.reLaunch({ url: '/pages/maintenance/maintenance' });
          } catch (e) {}
        }
      },
    });
  },

  /** 使用 wx.request，避免无效 token 时 Promise 链报错；401 静默清 token */
  fetchProfile() {
    const app = this;
    const { baseUrl, token } = app.globalData;
    if (!token) return;
    wx.request({
      url: baseUrl + '/auth/profile',
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      success(res) {
        if (res.statusCode === 401) {
          app.clearToken();
          return;
        }
        if (res.data && res.data.code === 0 && res.data.data) {
          app.globalData.userInfo = res.data.data;
        }
      },
    });
  },

  request(options) {
    const app = this;
    const { baseUrl, token } = app.globalData;
    return new Promise((resolve, reject) => {
      wx.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        success: (res) => {
          if (res.statusCode === 503 || (res.data && res.data.code === 503)) {
            try {
              wx.reLaunch({ url: '/pages/maintenance/maintenance' });
            } catch (e) {}
            reject(new Error((res.data && res.data.message) || '系统维护中'));
            return;
          }
          if (res.statusCode === 401) {
            app.clearToken();
            reject(new Error('请先登录'));
            return;
          }
          if (res.data && res.data.code === 0) {
            resolve(res.data);
          } else {
            reject(new Error((res.data && res.data.message) || '请求失败'));
          }
        },
        fail: (err) => {
          reject(err.errMsg || new Error('网络错误'));
        },
      });
    });
  },

  setToken(token) {
    this.globalData.token = token;
    wx.setStorageSync('vino_token', token);
  },

  clearToken() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    wx.removeStorageSync('vino_token');
  },

  isLoggedIn() {
    return !!this.globalData.token;
  },

  checkLogin() {
    if (!this.isLoggedIn()) {
      wx.showModal({
        title: '未登录',
        content: '请先登录后再操作',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        },
      });
      return false;
    }
    return true;
  },
});
