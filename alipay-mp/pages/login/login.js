const app = getApp();
const i18n = require('../../utils/i18n.js');

Page({
  data: {
    logging: false,
    saving: false,
    isLoggedIn: false,
    showProfile: false,
    tempAvatarUrl: '',
    tempNickname: '',
    headerLogoDesc: '',
  },

  onLoad() {
    const setTitle = () => i18n.setNavTitle('login.title');
    if (i18n.isLoaded()) setTitle(); else i18n.loadI18nTexts(setTitle);
    app.request({ url: '/home-config' }).then(res => {
      const list = res.data || [];
      const headerLogo = list.find(i => i.section === 'headerLogo' && i.status === 'active');
      if (headerLogo && headerLogo.desc) {
        this.setData({ headerLogoDesc: headerLogo.desc });
      }
    }).catch(() => {});
  },

  alipayLogin() {
    this.setData({ logging: true });
    my.getAuthCode({
      scopes: 'auth_base',
      success: (authRes) => {
        if (!authRes.authCode) {
          my.showToast({ content: '获取授权码失败', type: 'none' });
          this.setData({ logging: false });
          return;
        }
        app.request({
          method: 'POST',
          url: '/auth/alipay-login',
          data: { code: authRes.authCode },
        })
          .then((res) => {
            const { token, user, isNew } = res.data;
            app.setToken(token);
            app.globalData.userInfo = user;
            if (isNew) {
              this.setData({ isLoggedIn: true, showProfile: true, logging: false });
            } else {
              this.setData({ logging: false });
              this.goBack();
            }
          })
          .catch((err) => {
            my.showToast({ content: err.message || '登录失败', type: 'none' });
            this.setData({ logging: false });
          });
      },
      fail: () => {
        my.showToast({ content: '支付宝授权失败', type: 'none' });
        this.setData({ logging: false });
      },
    });
  },

  chooseAvatar() {
    my.chooseImage({
      count: 1,
      success: (res) => {
        if (res.apFilePaths && res.apFilePaths.length) {
          this.setData({ tempAvatarUrl: res.apFilePaths[0] });
        }
      },
    });
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  saveProfile() {
    const { tempAvatarUrl, tempNickname } = this.data;
    this.setData({ saving: true });

    const doSave = (avatarServerUrl) => {
      const updateData = {};
      if (tempNickname.trim()) updateData.nickname = tempNickname.trim();
      if (avatarServerUrl) updateData.avatar = avatarServerUrl;

      if (!Object.keys(updateData).length) {
        this.setData({ saving: false });
        this.goBack();
        return;
      }

      app.request({
        method: 'PUT',
        url: '/auth/profile',
        data: updateData,
      })
        .then((res) => {
          app.globalData.userInfo = res.data;
          this.setData({ saving: false });
          my.showToast({ content: '设置成功', type: 'success' });
          setTimeout(() => this.goBack(), 800);
        })
        .catch(() => {
          this.setData({ saving: false });
          this.goBack();
        });
    };

    if (tempAvatarUrl && tempAvatarUrl.startsWith('http')) {
      doSave(tempAvatarUrl);
    } else if (tempAvatarUrl) {
      my.uploadFile({
        url: app.globalData.baseUrl + '/auth/upload-avatar',
        fileType: 'image',
        fileName: 'avatar',
        filePath: tempAvatarUrl,
        header: {
          Authorization: 'Bearer ' + app.globalData.token,
        },
        success: (uploadRes) => {
          try {
            const data = JSON.parse(uploadRes.data);
            if (data.code === 0) {
              doSave(data.data.url);
            } else {
              doSave('');
            }
          } catch {
            doSave('');
          }
        },
        fail: () => doSave(''),
      });
    } else {
      doSave('');
    }
  },

  skipProfile() {
    this.goBack();
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      my.navigateBack();
    } else {
      my.switchTab({ url: '/pages/index/index' });
    }
  },
});
