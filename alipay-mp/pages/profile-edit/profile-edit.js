const app = getApp();

Page({
  data: {
    userInfo: null,
    avatarUrl: '',
    nickname: '',
    userPhone: '',
    maskedPhone: '',
    bindPhone: '',
    bindCode: '',
    smsCountdown: 0,
    sendingSmsCode: false,
  },

  onShow() {
    if (!app.isLoggedIn()) {
      my.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.loadUser();
  },

  loadUser() {
    const user = app.globalData.userInfo;
    if (user) {
      this.applyUser(user);
      return;
    }
    app.request({ url: '/auth/profile' }).then(res => {
      const u = res.data || {};
      app.globalData.userInfo = u;
      this.applyUser(u);
    }).catch(() => {
      my.navigateTo({ url: '/pages/login/login' });
    });
  },

  applyUser(user) {
    const avatarUrl = user.avatar || '';
    const nickname = user.nickname || user.username || '';
    const userPhone = user.phone || '';
    const maskedPhone = userPhone ? userPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    this.setData({
      userInfo: user,
      avatarUrl,
      nickname,
      userPhone,
      maskedPhone,
    });
  },

  onBindPhoneInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, field === 'bindCode' ? 6 : 11);
    this.setData({ [field]: value });
  },

  onSendBindCode() {
    const phone = (this.data.bindPhone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      my.showToast({ content: '请输入正确手机号', type: 'none' });
      return;
    }
    this.setData({ sendingSmsCode: true });
    app.request({
      method: 'POST',
      url: '/auth/send-sms-code',
      data: { phone },
    })
      .then(() => {
        my.showToast({ content: '验证码已发送', type: 'success' });
        this.setData({ smsCountdown: 60, sendingSmsCode: false });
        const t = setInterval(() => {
          const n = this.data.smsCountdown - 1;
          this.setData({ smsCountdown: n });
          if (n <= 0) clearInterval(t);
        }, 1000);
      })
      .catch((err) => {
        this.setData({ sendingSmsCode: false });
        my.showToast({ content: err.message || '发送失败', type: 'none' });
      });
  },

  onSubmitBindPhone() {
    const { bindPhone, bindCode } = this.data;
    if (!/^1\d{10}$/.test(bindPhone)) {
      my.showToast({ content: '请输入正确手机号', type: 'none' });
      return;
    }
    if (!bindCode || bindCode.length !== 6) {
      my.showToast({ content: '请输入6位验证码', type: 'none' });
      return;
    }
    app.request({
      method: 'POST',
      url: '/auth/bind-phone',
      data: { phone: bindPhone, code: bindCode },
    })
      .then((res) => {
        const user = res.data || {};
        app.globalData.userInfo = user;
        const maskedPhone = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
        this.setData({
          userInfo: user,
          userPhone: user.phone || '',
          maskedPhone,
          bindPhone: '',
          bindCode: '',
        });
        my.showToast({ content: '绑定成功', type: 'success' });
      })
      .catch((err) => {
        my.showToast({ content: err.message || '绑定失败', type: 'none' });
      });
  },

  onChangePhoneTap() {
    this.setData({
      bindPhone: '',
      bindCode: '',
      userPhone: '',
      maskedPhone: '',
    });
  },

  chooseAvatar() {
    my.chooseImage({
      count: 1,
      success: (res) => {
        const tempUrl = res.apFilePaths && res.apFilePaths[0];
        if (!tempUrl) return;
        my.showLoading({ content: '上传中...' });
        my.uploadFile({
          url: app.globalData.baseUrl + '/auth/upload-avatar',
          fileType: 'image',
          fileName: 'avatar',
          filePath: tempUrl,
          header: { Authorization: 'Bearer ' + app.globalData.token },
          success: (uploadRes) => {
            my.hideLoading();
            try {
              const data = JSON.parse(uploadRes.data);
              if (data.code === 0) {
                const cosUrl = data.data.url;
                if (app.globalData.userInfo) app.globalData.userInfo.avatar = cosUrl;
                this.setData({ avatarUrl: cosUrl });
                my.showToast({ content: '头像已更新', type: 'success' });
              } else {
                my.showToast({ content: '上传失败', type: 'none' });
              }
            } catch {
              my.showToast({ content: '上传失败', type: 'none' });
            }
          },
          fail: () => {
            my.hideLoading();
            my.showToast({ content: '上传失败', type: 'none' });
          },
        });
      },
    });
  },

  onUpdateNickname(e) {
    const nickname = (e.detail.value || '').trim();
    if (!nickname || nickname === (this.data.userInfo && this.data.userInfo.nickname)) return;
    app.request({
      method: 'PUT',
      url: '/auth/profile',
      data: { nickname },
    }).then(res => {
      const user = res.data || {};
      app.globalData.userInfo = user;
      this.setData({ nickname: user.nickname || user.username || '' });
      my.showToast({ content: '昵称已更新', type: 'success' });
    }).catch(() => {
      my.showToast({ content: '更新失败', type: 'none' });
    });
  },
});
