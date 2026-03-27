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

App({
  globalData: {
    baseUrl: 'http://106.54.50.88:5202/api',
    userInfo: null,
    token: '',
    currencySymbol: currencyUtil.DEFAULT_CURRENCY,
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
    this.loadCurrencySymbol();
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
