const app = getApp();

Page({
  data: {
    editId: '',
    contactName: '',
    contactPhone: '',
    country: '中国大陆',
    customCountry: '',
    province: '',
    city: '',
    district: '',
    regionText: '',
    detailAddress: '',
    isDefault: false,
    countries: ['中国大陆', '中国香港', '中国澳门', '中国台湾', '美国', '日本', '韩国', '新加坡', '其他'],
    countryIdx: 0,
  },

  onLoad(opts) {
    if (opts.id) {
      this.setData({ editId: opts.id });
      this.loadAddress(opts.id);
    }
  },

  loadAddress(id) {
    app.request({ url: '/address' })
      .then(res => {
        const addr = (res.data || []).find(a => String(a.id) === String(id));
        if (addr) {
          const idx = this.data.countries.indexOf(addr.country);
          this.setData({
            contactName: addr.contactName || '',
            contactPhone: addr.contactPhone || '',
            country: addr.country || '中国大陆',
            customCountry: addr.customCountry || '',
            province: addr.province || '',
            city: addr.city || '',
            district: addr.district || '',
            regionText: [addr.province, addr.city, addr.district].filter(Boolean).join(' '),
            detailAddress: addr.detailAddress || '',
            isDefault: !!addr.isDefault,
            countryIdx: idx >= 0 ? idx : 0,
          });
        }
      });
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  onCountry(e) { const idx = e.detail.value; this.setData({ countryIdx: idx, country: this.data.countries[idx] }); },
  onRegionInput(e) {
    const parts = e.detail.value.split(/\s+/);
    this.setData({ regionText: e.detail.value, province: parts[0] || '', city: parts[1] || '', district: parts[2] || '' });
  },
  onDefault(e) { this.setData({ isDefault: e.detail.value }); },

  save() {
    const { editId, contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault } = this.data;
    if (!contactName.trim()) return my.showToast({ content: '请输入联系人' });
    if (!contactPhone.trim()) return my.showToast({ content: '请输入手机号' });
    if (!detailAddress.trim()) return my.showToast({ content: '请输入详细地址' });

    const body = { contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault };
    app.request({ url: editId ? '/address/' + editId : '/address', method: editId ? 'PUT' : 'POST', data: body })
      .then(() => { my.showToast({ content: '保存成功' }); setTimeout(() => my.navigateBack(), 500); })
      .catch(() => my.showToast({ content: '保存失败' }));
  },
});
