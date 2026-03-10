App({
  globalData: {
    baseUrl: 'http://106.54.50.88:5202/api',
    userInfo: null,
    token: '',
  },

  onLaunch() {
    const token = my.getStorageSync({ key: 'vino_token' }).data;
    if (token) {
      this.globalData.token = token;
    }
  },

  request(options) {
    const { baseUrl, token } = this.globalData;
    return new Promise((resolve, reject) => {
      my.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        success: (res) => {
          if (res.data.code === 0) {
            resolve(res.data);
          } else {
            reject(new Error(res.data.message));
          }
        },
        fail: reject,
      });
    });
  },
});
