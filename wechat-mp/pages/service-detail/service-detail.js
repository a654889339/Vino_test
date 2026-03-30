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
    country: '中国大陆',
    customCountry: '',
    region: [],
    detailAddress: '',
    remark: '',
    countryList,
    countryIndex: 0,
    productSerial: '',
    myProducts: [],
    productSerialPickerLabels: [],
    productSerialPickerIndex: 0,
    productCategories: [],
    categoryPickerLabels: [],
    categoryPickerIndex: 0,
    allGuides: [],
    filteredGuideLabels: [],
    guidePickerIndex: 0,
    selectedCategoryId: null,
    selectedGuideId: null,
    productFieldsLocked: false,
  },

  onLoad(options) {
    const id = options.id;
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
    wx.navigateTo({ url: '/pages/chat/chat?autoMsg=' + encodeURIComponent(msg) });
  },

  preventTouchMove() {},
  preventClose() {},

  /** 将 /auth/my-products 转为列表 + 下拉展示用文案 */
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
    this.prefillOrderFormAndOpen();
  },

  /** 打开预约弹窗并填充默认地址 + 用户资料中的手机（地址里缺省时补齐） */
  prefillOrderFormAndOpen() {
    const emptyForm = {
      showOrderForm: true,
      contactName: '',
      contactPhone: '',
      country: '中国大陆',
      customCountry: '',
      region: [],
      detailAddress: '',
      remark: '',
      countryIndex: 0,
      productSerial: '',
      productSerialPickerIndex: 0,
      categoryPickerIndex: 0,
      guidePickerIndex: 0,
      selectedCategoryId: null,
      selectedGuideId: null,
      productFieldsLocked: false,
      filteredGuideLabels: [],
    };

    const trimStr = (v) => (v != null ? String(v).trim() : '');

    /** 地址与资料合并：电话优先地址，缺省用账号手机号；详细地址用默认地址 */
    const applyAddrWithProfile = (addr, profile, mpPayload = {}) => {
      const p = profile || {};
      const a = addr || {};
      const list = this.data.countryList;
      let country = trimStr(a.country) || '中国大陆';
      let idx = list.indexOf(country);
      if (idx < 0) {
        country = '中国大陆';
        idx = 0;
      }
      let region = [];
      if (country === '中国大陆' && (a.province || a.city || a.district)) {
        region = [a.province || '', a.city || '', a.district || ''];
      }
      const phoneFromAddr = trimStr(a.contactPhone);
      const phoneFromUser = trimStr(p.phone);
      const nameFromAddr = trimStr(a.contactName);
      const nameFromUser = trimStr(p.nickname);
      const detail = trimStr(a.detailAddress);

      this.setData({
        showOrderForm: true,
        contactName: nameFromAddr || nameFromUser,
        contactPhone: phoneFromAddr || phoneFromUser,
        country,
        countryIndex: idx,
        customCountry: trimStr(a.customCountry),
        region,
        detailAddress: detail,
        remark: '',
        ...mpPayload,
      });
    };

    Promise.all([
      app.request({ url: '/addresses' }).catch(() => ({ data: [] })),
      app.request({ url: '/auth/profile' }).catch(() => ({ data: {} })),
      app.request({ url: '/auth/my-products' }).catch(() => ({ data: [] })),
      app.request({ url: '/guides/categories' }).catch(() => ({ data: [] })),
      app.request({ url: '/guides' }).catch(() => ({ data: [] })),
    ])
      .then(([addrRes, profRes, mpRes, catRes, guideRes]) => {
        const mpPayload = this.buildMyProductsPickerPayload(mpRes);
        const cats = catRes.data || [];
        const guides = (guideRes.data || []).map(g => ({ id: g.id, name: g.name, categoryId: g.categoryId }));
        const catPayload = {
          productCategories: cats,
          categoryPickerLabels: cats.map(c => c.name),
          allGuides: guides,
        };
        const list = addrRes.data || [];
        const u = profRes.data || {};
        if (list.length) {
          const def = list.find((a) => a.isDefault) || list[0];
          applyAddrWithProfile(def, u, { ...mpPayload, ...catPayload });
        } else {
          this.setData({
            ...emptyForm,
            contactName: trimStr(u.nickname),
            contactPhone: trimStr(u.phone),
            ...mpPayload,
            ...catPayload,
          });
        }
      })
      .catch(() => {
        this.setData({
          ...emptyForm,
          myProducts: [],
          productSerialPickerLabels: [],
        });
      });
  },

  onCountryChange(e) {
    const i = parseInt(e.detail.value, 10);
    this.setData({
      countryIndex: i,
      country: this.data.countryList[i],
      region: [],
    });
  },

  onRegionChange(e) {
    const v = e.detail.value;
    const arr = Array.isArray(v) ? v : [];
    this.setData({ region: arr });
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
      this.applyMyProduct(p, i);
    }
  },

  applyMyProduct(p, pickerIdx) {
    const cats = this.data.productCategories;
    const guides = this.data.allGuides;
    let catIdx = 0;
    let guideIdx = 0;
    let filteredGuideLabels = [];
    const catId = p.categoryId || null;
    const guideId = p.guideId || null;

    if (catId) {
      const ci = cats.findIndex(c => c.id === catId);
      if (ci >= 0) catIdx = ci;
      const filtered = guides.filter(g => g.categoryId === catId);
      filteredGuideLabels = filtered.map(g => g.name);
      if (guideId) {
        const gi = filtered.findIndex(g => g.id === guideId);
        if (gi >= 0) guideIdx = gi;
      }
    }

    this.setData({
      productSerialPickerIndex: pickerIdx != null ? pickerIdx : this.data.productSerialPickerIndex,
      productSerial: String(p.productKey || '').slice(0, 128),
      selectedCategoryId: catId,
      selectedGuideId: guideId,
      categoryPickerIndex: catIdx,
      guidePickerIndex: guideIdx,
      filteredGuideLabels,
      productFieldsLocked: true,
    });
  },

  unlockProductFields() {
    this.setData({
      selectedCategoryId: null,
      selectedGuideId: null,
      categoryPickerIndex: 0,
      guidePickerIndex: 0,
      filteredGuideLabels: [],
      productSerial: '',
      productFieldsLocked: false,
    });
  },

  onCategoryPickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const cats = this.data.productCategories;
    const cat = cats[i];
    if (!cat) return;
    const filtered = this.data.allGuides.filter(g => g.categoryId === cat.id);
    this.setData({
      categoryPickerIndex: i,
      selectedCategoryId: cat.id,
      selectedGuideId: null,
      guidePickerIndex: 0,
      filteredGuideLabels: filtered.map(g => g.name),
    });
  },

  onGuidePickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const cats = this.data.productCategories;
    const catId = this.data.selectedCategoryId;
    const filtered = this.data.allGuides.filter(g => g.categoryId === catId);
    const g = filtered[i];
    if (!g) return;
    this.setData({
      guidePickerIndex: i,
      selectedGuideId: g.id,
    });
  },

  closeOrderForm() {
    this.setData({ showOrderForm: false });
  },

  buildFullAddress() {
    const { country, customCountry, region, detailAddress } = this.data;
    const parts = [];
    if (country === '其他') {
      parts.push(customCountry || '其他');
    } else if (country) {
      parts.push(country);
    }
    if (country === '中国大陆' && region && region.length === 3 && (region[0] || region[1] || region[2])) {
      parts.push(region[0], region[1], region[2]);
    }
    if (detailAddress) parts.push(detailAddress);
    return parts.filter(Boolean).join(' ');
  },

  submitOrder() {
    const { contactName, contactPhone, country, customCountry, region, detailAddress, serviceData, productSerial, selectedCategoryId, selectedGuideId } = this.data;
    if (!selectedCategoryId) {
      wx.showToast({ title: '请选择商品种类', icon: 'none' });
      return;
    }
    if (!selectedGuideId) {
      wx.showToast({ title: '请选择具体商品', icon: 'none' });
      return;
    }
    if (!contactName || !contactName.trim()) {
      wx.showToast({ title: '请输入联系人', icon: 'none' });
      return;
    }
    if (!contactPhone || !contactPhone.trim()) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }
    if (!country) {
      wx.showToast({ title: '请选择国家/地区', icon: 'none' });
      return;
    }
    if (country === '其他' && !(customCountry && customCountry.trim())) {
      wx.showToast({ title: '请输入国家/地区名称', icon: 'none' });
      return;
    }
    if (country === '中国大陆' && (!region || region.length < 3 || !region[0])) {
      wx.showToast({ title: '请选择省市区', icon: 'none' });
      return;
    }
    if (!detailAddress || !detailAddress.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
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
      guideId: selectedGuideId,
    };

    app.request({
      method: 'POST',
      url: '/orders',
      data: payload,
    })
      .then(() => {
        this.setData({ showOrderForm: false, submitting: false });
        wx.showModal({
          title: '预约成功',
          content: '您的服务已预约成功，我们会尽快安排工程师。',
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: '/pages/orders/orders' });
          },
        });
      })
      .catch(err => {
        this.setData({ submitting: false });
        wx.showToast({ title: err.message || '下单失败', icon: 'none' });
      });
  },
});
