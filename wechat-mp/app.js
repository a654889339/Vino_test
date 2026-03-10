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
    }
  },

  request(options) {
    const { baseUrl, token } = this.globalData;
    return new Promise((resolve, reject) => {
      wx.request({
        url: baseUrl + options.url,
        method: options.method || 'GET',
        data: options.data,
        header: {
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
