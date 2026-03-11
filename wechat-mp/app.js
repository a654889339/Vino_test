App({
  globalData: {
    baseUrl: 'http://106.54.50.88:5202/api',
    userInfo: null,
    token: '',
  },

  onLaunch() {
    const token = wx.getStorageSync('vino_token');
    if (token) {
      this.globalData.token = token;
      this.fetchProfile();
    }
  },

  fetchProfile() {
    this.request({ url: '/auth/profile' })
      .then(res => {
        this.globalData.userInfo = res.data;
      })
      .catch(() => {
        this.clearToken();
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
