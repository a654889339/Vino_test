App({
  globalData: {
    baseUrl: 'http://106.54.50.88:5202/api',
    userInfo: null,
    token: '',
  },

  onLaunch() {
    try {
      const res = my.getStorageSync({ key: 'vino_token' });
      const token = res && res.data ? res.data : '';
      if (token) {
        this.globalData.token = token;
        this.fetchProfile();
      }
    } catch (e) {
      // ignore
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
