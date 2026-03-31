const app = getApp();
const i18n = require('../../utils/i18n.js');

function buildCountries() {
  return [
    i18n.t('country.cn'), i18n.t('country.hk'), i18n.t('country.mo'), i18n.t('country.tw'),
    i18n.t('country.us'), i18n.t('country.jp'), i18n.t('country.kr'), i18n.t('country.sg'),
    i18n.t('country.other'),
  ];
}

Page({
  data: {
    editId: '',
    contactName: '',
    contactPhone: '',
    country: '',
    customCountry: '',
    province: '',
    city: '',
    district: '',
    detailAddress: '',
    isDefault: false,
    countries: [],
    countryIdx: 0,
    labelContact: '',
    labelPhone: '',
    labelCountry: '',
    labelCustomCountry: '',
    labelRegion: '',
    labelAddress: '',
    labelDefault: '',
    phContact: '',
    phPhone: '',
    phSelect: '',
    phCustomCountry: '',
    phRegion: '',
    phAddress: '',
    saveText: '',
  },

  onLoad(opts) {
    const self = this;
    const doRefresh = () => {
      self.refreshI18n();
      if (opts.id) {
        self.setData({ editId: opts.id });
        self.loadAddress(opts.id);
      }
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    const countries = buildCountries();
    this.setData({
      countries,
      country: this.data.country || countries[0],
      labelContact: i18n.t('addressEdit.contact'),
      labelPhone: i18n.t('addressEdit.phone'),
      labelCountry: i18n.t('addressEdit.country'),
      labelCustomCountry: i18n.t('addressEdit.customCountry'),
      labelRegion: i18n.t('addressEdit.region'),
      labelAddress: i18n.t('addressEdit.address'),
      labelDefault: i18n.t('addressEdit.setDefault'),
      phContact: i18n.t('addressEdit.phContact'),
      phPhone: i18n.t('addressEdit.phPhone'),
      phSelect: i18n.t('addressEdit.phSelect'),
      phCustomCountry: i18n.t('addressEdit.phCustomCountry'),
      phRegion: i18n.t('addressEdit.phRegion'),
      phAddress: i18n.t('addressEdit.phAddress'),
      saveText: i18n.t('addressEdit.save'),
    });
  },

  loadAddress(id) {
    app.request({ url: '/addresses' })
      .then(res => {
        const addr = (res.data || []).find(a => String(a.id) === String(id));
        if (addr) {
          const idx = this.data.countries.indexOf(addr.country);
          this.setData({
            contactName: addr.contactName || '',
            contactPhone: addr.contactPhone || '',
            country: addr.country || i18n.t('country.cn'),
            customCountry: addr.customCountry || '',
            province: addr.province || '',
            city: addr.city || '',
            district: addr.district || '',
            detailAddress: addr.detailAddress || '',
            isDefault: !!addr.isDefault,
            countryIdx: idx >= 0 ? idx : 0,
          });
        }
      });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onCountry(e) {
    const idx = e.detail.value;
    this.setData({ countryIdx: idx, country: this.data.countries[idx] });
  },

  onRegion(e) {
    const [province, city, district] = e.detail.value;
    this.setData({ province, city, district });
  },

  onDefault(e) {
    this.setData({ isDefault: e.detail.value });
  },

  save() {
    const { editId, contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault } = this.data;
    if (!contactName.trim()) return wx.showToast({ title: i18n.t('addressEdit.errContact'), icon: 'none' });
    if (!contactPhone.trim()) return wx.showToast({ title: i18n.t('addressEdit.errPhone'), icon: 'none' });
    if (!detailAddress.trim()) return wx.showToast({ title: i18n.t('addressEdit.errAddress'), icon: 'none' });

    const body = { contactName, contactPhone, country, customCountry, province, city, district, detailAddress, isDefault };
    const url = editId ? '/addresses/' + editId : '/addresses';
    const method = editId ? 'PUT' : 'POST';

    app.request({ url, method, data: body })
      .then(() => {
        wx.showToast({ title: i18n.t('addressEdit.saveSuccess') });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => wx.showToast({ title: i18n.t('addressEdit.saveFailed'), icon: 'none' }));
  },
});
