const app = getApp();

Page({
  data: {
    isRegister: false,
    username: '',
    password: '',
    email: '',
    code: '',
    nickname: '',
    codeCountdown: 0,
    loading: false,
  },

  switchMode() {
    this.setData({
      isRegister: !this.data.isRegister,
      username: '',
      password: '',
      email: '',
      code: '',
      nickname: '',
    });
  },

  inputUsername(e) {
    this.setData({ username: e.detail.value });
  },
  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },
  inputEmail(e) {
    this.setData({ email: e.detail.value });
  },
  inputCode(e) {
    this.setData({ code: e.detail.value });
  },
  inputNickname(e) {
    this.setData({ nickname: e.detail.value });
  },

  sendCode() {
    const { email, codeCountdown } = this.data;
    if (!email || !email.trim()) {
      wx.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (codeCountdown > 0) return;
    app
      .request({
        method: 'POST',
        url: '/auth/send-code',
        data: { email: email.trim() },
      })
      .then(() => {
        wx.showToast({ title: '验证码已发送', icon: 'success' });
        this.setData({ codeCountdown: 60 });
        this.startCountdown();
      })
      .catch(err => {
        wx.showToast({ title: err.message || '发送失败', icon: 'none' });
      });
  },

  startCountdown() {
    const t = setInterval(() => {
      const n = this.data.codeCountdown - 1;
      this.setData({ codeCountdown: n });
      if (n <= 0) clearInterval(t);
    }, 1000);
  },

  handleLogin() {
    const { username, password } = this.data;
    if (!username || !username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }
    if (!password || !password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    app
      .request({
        method: 'POST',
        url: '/auth/login',
        data: { username: username.trim(), password: password.trim() },
      })
      .then(res => {
        const token = res.data && res.data.token;
        const user = res.data && res.data.user;
        if (token) {
          app.setToken(token);
          app.globalData.userInfo = user || {};
        }
        this.setData({ loading: false });
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }, 500);
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: err.message || '登录失败', icon: 'none' });
      });
  },

  handleRegister() {
    const { username, password, email, code, nickname } = this.data;
    if (!username || !username.trim()) {
      wx.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }
    if (!password || !password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (!email || !email.trim()) {
      wx.showToast({ title: '请输入邮箱', icon: 'none' });
      return;
    }
    if (!code || !code.trim()) {
      wx.showToast({ title: '请输入验证码', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    app
      .request({
        method: 'POST',
        url: '/auth/register',
        data: {
          username: username.trim(),
          password: password.trim(),
          email: email.trim(),
          code: code.trim(),
          nickname: (nickname || username).trim(),
        },
      })
      .then(res => {
        const token = res.data && res.data.token;
        const user = res.data && res.data.user;
        if (token) {
          app.setToken(token);
          app.globalData.userInfo = user || {};
        }
        this.setData({ loading: false });
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            wx.switchTab({ url: '/pages/index/index' });
          }
        }, 500);
      })
      .catch(err => {
        this.setData({ loading: false });
        wx.showToast({ title: err.message || '注册失败', icon: 'none' });
      });
  },

  submit() {
    if (this.data.isRegister) {
      this.handleRegister();
    } else {
      this.handleLogin();
    }
  },
});
