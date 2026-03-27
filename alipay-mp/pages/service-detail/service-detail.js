const app = getApp();
const { formatPriceDisplay } = require('../../utils/currency.js');

function enrichServiceData(s) {
  const sym = app.globalData.currencySymbol || '¥';
  const op = s.originPrice;
  const showOrigin = op != null && op !== '' && Number(op) > 0;
  return {
    id: s.id,
    title: s.title || '服务',
    description: s.description || '专业服务，品质保障',
    price: s.price,
    originPrice: s.originPrice,
    priceDisplay: formatPriceDisplay(s.price, sym),
    originPriceDisplay: showOrigin ? formatPriceDisplay(op, sym) : '',
    showOriginPrice: showOrigin,
  };
}

const countryList = ['中国大陆', '中国香港', '中国澳门', '中国台湾', '美国', '英国', '日本', '韩国', '新加坡', '澳大利亚', '加拿大', '德国', '法国', '马来西亚', '泰国', '其他'];

Page({
  data: {
    serviceId: null,
    serviceData: {},
    loading: true,
    showOrderForm: false,
    submitting: false,
    contactName: '',
    contactPhone: '',
    country: '',
    customCountry: '',
    regionText: '',
    detailAddress: '',
    remark: '',
    countryList,
    countryIndex: -1,
    productSerial: '',
    myProducts: [],
    productSerialPickerLabels: [],
    productSerialPickerIndex: 0,
  },

  onLoad(query) {
    const id = query.id;
    this.setData({ serviceId: id });
    this.loadService(id);
  },

  loadService(id) {
    if (!id) {
      this.setData({ loading: false, serviceData: enrichServiceData(this.getFallbackService(1)) });
      return;
    }
    app.request({ url: `/services/${id}` })
      .then(res => {
        const s = res.data || {};
        this.setData({
          loading: false,
          serviceData: enrichServiceData({
            id: s.id,
            title: s.title || '服务',
            description: s.description || '专业服务，品质保障',
            price: s.price || 0,
            originPrice: s.originPrice,
          }),
        });
      })
      .catch(() => {
        this.setData({ loading: false, serviceData: enrichServiceData(this.getFallbackService(id)) });
      });
  },

  getFallbackService(id) {
    const map = {
      1: { title: '设备维修', description: '专业工程师提供全方位维修服务，品质保障，售后无忧。', price: '99', originPrice: '159' },
      2: { title: '上门维修', description: '快速响应，工程师2小时内上门服务。', price: '149', originPrice: '199' },
      3: { title: '远程支持', description: '在线视频指导，远程诊断问题。', price: '29', originPrice: '49' },
      4: { title: '深度清洁', description: '全方位清洁保养，焕然一新。', price: '149', originPrice: '199' },
      5: { title: '日常清洁', description: '基础维护清洁，保持良好状态。', price: '69', originPrice: '89' },
      6: { title: '全面检测', description: '系统全面评估，发现潜在问题。', price: '49', originPrice: '79' },
      7: { title: '性能优化', description: '提速升级，优化系统性能。', price: '79', originPrice: '129' },
      8: { title: '数据恢复', description: '专业数据找回，高成功率。', price: '199', originPrice: '299' },
      9: { title: '数据备份', description: '安全迁移，完整备份保护。', price: '59', originPrice: '89' },
    };
    return map[id] || map[1];
  },

  onConsult() {
    const s = this.data.serviceData;
    const sym = app.globalData.currencySymbol || '¥';
    const pricePart = Number(s.price) !== 0 && s.price != null && s.price !== ''
      ? '（' + formatPriceDisplay(s.price, sym) + '）'
      : '';
    const msg = '我想咨询一下【' + (s.title || '该服务') + '】' + pricePart + (s.description ? '：' + s.description : '');
    my.navigateTo({ url: '/pages/chat/chat?autoMsg=' + encodeURIComponent(msg) });
  },

  buildMyProductsPickerPayload(res) {
    const list = (res && res.data) || [];
    const productSerialPickerLabels = list.map((p) => {
      const name = ((p && p.productName) || '商品').trim() || '商品';
      const key = String((p && p.productKey) || '').trim();
      return key ? `${name} · ${key}` : name;
    });
    return { myProducts: list, productSerialPickerLabels };
  },

  onBookTap() {
    if (!app.checkLogin()) return;
    this.setData({
      showOrderForm: true,
      productSerial: '',
      productSerialPickerIndex: 0,
    });
    app.request({ url: '/auth/my-products' })
      .then((res) => {
        this.setData(this.buildMyProductsPickerPayload(res));
      })
      .catch(() => {
        this.setData({ myProducts: [], productSerialPickerLabels: [] });
      });
  },

  onCountryChange(e) {
    const i = parseInt(e.detail.value, 10);
    this.setData({
      countryIndex: i,
      country: this.data.countryList[i],
      regionText: '',
    });
  },

  inputContactName(e) {
    this.setData({ contactName: e.detail.value });
  },
  inputContactPhone(e) {
    this.setData({ contactPhone: e.detail.value });
  },
  inputCustomCountry(e) {
    this.setData({ customCountry: e.detail.value });
  },
  inputRegionText(e) {
    this.setData({ regionText: e.detail.value });
  },
  inputDetailAddress(e) {
    this.setData({ detailAddress: e.detail.value });
  },
  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  inputProductSerial(e) {
    const v = (e.detail.value || '').slice(0, 128);
    const { myProducts } = this.data;
    let idx = this.data.productSerialPickerIndex;
    if (Array.isArray(myProducts) && myProducts.length) {
      const i = myProducts.findIndex((p) => String(p.productKey || '') === v);
      if (i >= 0) idx = i;
    }
    this.setData({ productSerial: v, productSerialPickerIndex: idx });
  },

  onMyProductSerialPick(e) {
    const i = parseInt(e.detail.value, 10);
    const p = this.data.myProducts[i];
    if (p && p.productKey) {
      this.setData({
        productSerialPickerIndex: i,
        productSerial: String(p.productKey).slice(0, 128),
      });
    }
  },

  closeOrderForm() {
    this.setData({ showOrderForm: false });
  },

  stopPropagation() {
    // Prevent modal from closing when tapping content area
  },

  buildFullAddress() {
    const { country, customCountry, regionText, detailAddress } = this.data;
    const parts = [];
    if (country === '其他') {
      parts.push(customCountry || '其他');
    } else if (country) {
      parts.push(country);
    }
    if (country === '中国大陆' && regionText && regionText.trim()) {
      parts.push(regionText.trim());
    }
    if (detailAddress) parts.push(detailAddress);
    return parts.filter(Boolean).join(' ');
  },

  submitOrder() {
    const { contactName, contactPhone, country, customCountry, regionText, detailAddress, serviceData, productSerial } = this.data;
    if (!contactName || !contactName.trim()) {
      my.showToast({ content: '请输入联系人', type: 'none' });
      return;
    }
    if (!contactPhone || !contactPhone.trim()) {
      my.showToast({ content: '请输入联系电话', type: 'none' });
      return;
    }
    if (!country) {
      my.showToast({ content: '请选择国家/地区', type: 'none' });
      return;
    }
    if (country === '其他' && !(customCountry && customCountry.trim())) {
      my.showToast({ content: '请输入国家/地区名称', type: 'none' });
      return;
    }
    if (country === '中国大陆' && !(regionText && regionText.trim())) {
      my.showToast({ content: '请输入省/市/区', type: 'none' });
      return;
    }
    if (!detailAddress || !detailAddress.trim()) {
      my.showToast({ content: '请输入详细地址', type: 'none' });
      return;
    }

    const fullAddress = this.buildFullAddress();
    this.setData({ submitting: true });

    const payload = {
      serviceId: parseInt(this.data.serviceId, 10) || null,
      serviceTitle: serviceData.title,
      serviceIcon: 'setting-o',
      price: serviceData.price,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      address: fullAddress,
      remark: (this.data.remark || '').trim(),
      productSerial: (productSerial || '').trim().slice(0, 128),
    };

    app.request({
      method: 'POST',
      url: '/orders',
      data: payload,
    })
      .then(() => {
        this.setData({ showOrderForm: false, submitting: false });
        my.confirm({
          title: '预约成功',
          content: '您的服务已预约成功，我们会尽快安排工程师。',
          showCancel: false,
          success: () => {
            my.switchTab({ url: '/pages/orders/orders' });
          },
        });
      })
      .catch(err => {
        this.setData({ submitting: false });
        my.showToast({ content: err.message || '下单失败', type: 'none' });
      });
  },
});
