const app = getApp();

Page({
  data: {
    headerLogoUrl: '',
    heroBgUrl: '',
    navItems: [
      { title: '全部服务', emoji: '📋', color: '#B91C1C' },
      { title: '预约', emoji: '📅', color: '#D97706' },
      { title: '维修', emoji: '🔧', color: '#2563EB' },
      { title: '咨询', emoji: '💬', color: '#7C3AED' },
      { title: '安装', emoji: '📦', color: '#059669' },
      { title: '保养', emoji: '🛡️', color: '#DC2626' },
      { title: '检测', emoji: '🔍', color: '#EA580C' },
      { title: '更多', emoji: '···', color: '#6B7280' },
    ],
    hotServices: [],
    recommends: [
      { id: 1, title: '会员权益', desc: '专属折扣', emoji: '🏅', bg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
      { id: 2, title: '服务保障', desc: '无忧售后', emoji: '🛡️', bg: 'linear-gradient(135deg, #10B981, #059669)' },
      { id: 3, title: '积分商城', desc: '好礼兑换', emoji: '🎁', bg: 'linear-gradient(135deg, #EC4899, #DB2777)' },
      { id: 4, title: '邀请有礼', desc: '分享得佣金', emoji: '👥', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
    ],
  },

  onShow() {
    this.loadHomeConfig();
    this.loadHotServices();
  },

  loadHomeConfig() {
    app.request({ url: '/home-config?all=1' })
      .then(res => {
        const items = res.data || [];
        const headerLogo = items.find(i => i.section === 'headerLogo' && i.status === 'active');
        const homeBg = items.find(i => i.section === 'homeBg' && i.status === 'active');
        this.setData({
          headerLogoUrl: headerLogo ? headerLogo.imageUrl : '',
          heroBgUrl: homeBg ? homeBg.imageUrl : '',
        });
      })
      .catch(() => {});
  },

  loadHotServices() {
    app.request({ url: '/services' })
      .then(res => {
        const data = (res.data || []).slice(0, 8);
        const hotServices = data.map(s => ({
          id: s.id,
          title: s.title || '服务',
          desc: s.description || '专业服务',
          price: s.price || 0,
          emoji: '🔧',
          bg: 'linear-gradient(135deg, #B91C1C, #991B1B)',
        }));
        this.setData({ hotServices: hotServices.length ? hotServices : this.getFallbackHotServices() });
      })
      .catch(() => {
        this.setData({ hotServices: this.getFallbackHotServices() });
      });
  },

  getFallbackHotServices() {
    return [
      { id: 1, title: '设备维修', desc: '专业工程师', price: '99', emoji: '🔧', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
      { id: 2, title: '深度清洁', desc: '全方位保养', price: '149', emoji: '✨', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
      { id: 3, title: '系统检测', desc: '全面评估', price: '49', emoji: '🔍', bg: 'linear-gradient(135deg, #059669, #047857)' },
      { id: 4, title: '数据恢复', desc: '专业找回', price: '199', emoji: '💾', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
    ];
  },

  goService() {
    my.switchTab({ url: '/pages/service/service' });
  },

  goServiceList() {
    my.switchTab({ url: '/pages/service/service' });
  },

  goServiceDetail(e) {
    const id = e.currentTarget.dataset.id;
    my.navigateTo({ url: `/pages/service-detail/service-detail?id=${id}` });
  },
});
