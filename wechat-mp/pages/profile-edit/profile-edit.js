const app = getApp();
const i18n = require('../../utils/i18n.js');

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
    labelAvatar: '',
    labelNickname: '',
    labelPhone: '',
    selectAvatarText: '',
    nicknamePh: '',
    changeText: '',
    phonePh: '',
    codePh: '',
    getCodeText: '',
    bindText: '',
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      self.loadUser();
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('profileEdit.title');
    this.setData({
      labelAvatar: i18n.t('profileEdit.changeAvatar'),
      labelNickname: i18n.t('profileEdit.changeNickname'),
      labelPhone: i18n.t('profileEdit.phone'),
      selectAvatarText: i18n.t('profileEdit.selectAvatar'),
      nicknamePh: i18n.t('profileEdit.nicknamePh'),
      changeText: i18n.t('profileEdit.change'),
      phonePh: i18n.t('profileEdit.phonePh'),
      codePh: i18n.t('profileEdit.codePh'),
      getCodeText: i18n.t('profileEdit.getCode'),
      bindText: i18n.t('profileEdit.bind'),
    });
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
      wx.navigateTo({ url: '/pages/login/login' });
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
      wx.showToast({ title: i18n.t('profileEdit.errPhone'), icon: 'none' });
      return;
    }
    this.setData({ sendingSmsCode: true });
    app.request({
      method: 'POST',
      url: '/auth/send-sms-code',
      data: { phone },
    })
      .then(() => {
        wx.showToast({ title: i18n.t('profileEdit.codeSent'), icon: 'success' });
        this.setData({ smsCountdown: 60, sendingSmsCode: false });
        const t = setInterval(() => {
          const n = this.data.smsCountdown - 1;
          this.setData({ smsCountdown: n });
          if (n <= 0) clearInterval(t);
        }, 1000);
      })
      .catch((err) => {
        this.setData({ sendingSmsCode: false });
        wx.showToast({ title: err.message || i18n.t('profileEdit.sendFailed'), icon: 'none' });
      });
  },

  onSubmitBindPhone() {
    const { bindPhone, bindCode } = this.data;
    if (!/^1\d{10}$/.test(bindPhone)) {
      wx.showToast({ title: i18n.t('profileEdit.errPhone'), icon: 'none' });
      return;
    }
    if (!bindCode || bindCode.length !== 6) {
      wx.showToast({ title: i18n.t('profileEdit.errCode'), icon: 'none' });
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
        wx.showToast({ title: i18n.t('profileEdit.bindSuccess'), icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || i18n.t('profileEdit.bindFailed'), icon: 'none' });
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

  onUpdateAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    wx.showLoading({ title: i18n.t('profileEdit.uploading') });
    wx.uploadFile({
      url: app.globalData.baseUrl + '/auth/upload-avatar',
      filePath: tempUrl,
      name: 'avatar',
      header: { Authorization: 'Bearer ' + app.globalData.token },
      success: (uploadRes) => {
        wx.hideLoading();
        try {
          const data = JSON.parse(uploadRes.data);
          if (data.code === 0) {
            const cosUrl = data.data.url;
            if (app.globalData.userInfo) app.globalData.userInfo.avatar = cosUrl;
            this.setData({ avatarUrl: cosUrl });
            wx.showToast({ title: i18n.t('profileEdit.avatarUpdated'), icon: 'success' });
          } else {
            wx.showToast({ title: data.message || i18n.t('profileEdit.uploadFailed'), icon: 'none' });
          }
        } catch {
          wx.showToast({ title: i18n.t('profileEdit.uploadFailed'), icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: i18n.t('profileEdit.uploadFailed'), icon: 'none' });
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
      wx.showToast({ title: i18n.t('profileEdit.nicknameUpdated'), icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: i18n.t('profileEdit.updateFailed'), icon: 'none' });
    });
  },
});
