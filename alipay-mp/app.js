function getJwtExpMs(token) {
  if (!token || typeof token !== 'string') return null;
  if (typeof my.base64ToArrayBuffer !== 'function') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const buf = my.base64ToArrayBuffer(b64);
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
const { BASE_URL } = require('./config.js');
const i18n = require('./utils/i18n.js');

function warnIfBadApiBase(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') return;
  const u = baseUrl.toLowerCase();
  const bad =
    /\.example\.(com|net|org)\b/.test(u) ||
    (u.includes('localhost') && u.includes(':5502'));
  if (!bad) return;
  try {
    my.alert({
      title: 'API 地址配置异常',
      content:
        '当前 baseUrl 指向无效或易错地址。请打开 config.js，将 BASE_URL 改为真实后端，例如：http://106.54.50.88:5202/api',
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
    my.request({
      url: app.globalData.baseUrl + '/home-config?section=currency',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      success(res) {
        const body = res.data;
        if (!body || body.code !== 0) return;
        const list = body.data || [];
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
    // 1) 若本地已保存语言偏好：直接加载文案并刷新 tabBar
    // 2) 若未保存：按 IP 自动判定（CN/HK/MO/TW→zh，其它→en），失败回退 zh
    if (i18n.getLang() && (i18n.getLang() === 'zh' || i18n.getLang() === 'en')) {
      i18n.applyTabBarLabels();
      i18n.loadI18nTexts();
    } else {
      i18n.detectLangByIp(() => {
        i18n.applyTabBarLabels();
        i18n.loadI18nTexts();
      });
    }
    try {
      const res = my.getStorageSync({ key: 'vino_token' });
      const token = res && res.data ? res.data : '';
      if (token) {
        const expMs = getJwtExpMs(token);
        if (expMs != null && Date.now() >= expMs) {
          this.clearToken();
          return;
        }
        this.globalData.token = token;
        this.fetchProfile();
      }
    } catch (e) {
      // ignore
    }
  },

  checkAppStatus() {
    const app = this;
    const { baseUrl } = app.globalData;
    my.request({
      url: baseUrl + '/app/status',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      success(res) {
        const status = res.status != null ? res.status : res.statusCode;
        const body = res.data;
        if (status !== 200 || !body || body.code !== 0) return;
        const d = body.data || null;
        app.globalData.featureFlags = d;
        if (d && d.maintenanceMode) {
          try {
            my.reLaunch({ url: '/pages/maintenance/maintenance' });
          } catch (e) {}
        }
      },
    });
  },

  fetchProfile() {
    const app = this;
    const { baseUrl, token } = app.globalData;
    if (!token) return;
    my.request({
      url: baseUrl + '/auth/profile',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      success(res) {
        const status = res.status != null ? res.status : res.statusCode;
        if (status === 401) {
          app.clearToken();
          return;
        }
        const body = res.data;
        if (body && body.code === 0 && body.data) {
          app.globalData.userInfo = body.data;
        }
      },
    });
  },

  request(options) {
    const app = this;
    const { baseUrl, token } = app.globalData;
    return new Promise((resolve, reject) => {
      my.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        success: (res) => {
          const status = res.status != null ? res.status : res.statusCode;
          if (status === 503 || (res.data && res.data.code === 503)) {
            try {
              my.reLaunch({ url: '/pages/maintenance/maintenance' });
            } catch (e) {}
            reject(new Error((res.data && res.data.message) || '系统维护中'));
            return;
          }
          if (res.status === 401 || (res.data && res.data.code === 401)) {
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
          reject(err.errorMessage || err.errMsg || new Error('网络错误'));
        },
      });
    });
  },

  setToken(token) {
    this.globalData.token = token;
    my.setStorageSync({ key: 'vino_token', data: token });
  },

  clearToken() {
    this.globalData.token = '';
    this.globalData.userInfo = null;
    my.removeStorageSync({ key: 'vino_token' });
  },

  isLoggedIn() {
    return !!this.globalData.token;
  },

  checkLogin() {
    if (!this.isLoggedIn()) {
      my.confirm({
        title: '未登录',
        content: '请先登录后再操作',
        confirmButtonText: '去登录',
        success: (res) => {
          if (res.confirm) {
            my.navigateTo({ url: '/pages/login/login' });
          }
        },
      });
      return false;
    }
    return true;
  },
});
