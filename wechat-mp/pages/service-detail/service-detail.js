const app = getApp();
const { formatPriceDisplay } = require('../../utils/currency.js');
const i18n = require('../../utils/i18n.js');

function enrichServiceData(s) {
  const sym = app.globalData.currencySymbol || '¥';
  const op = s.originPrice;
  const showOrigin = op != null && op !== '' && Number(op) > 0;
  // 英文模式优先取 *En 字段，未填写则回退中文；避免英文环境下显示为中文标题/描述
  const localTitle = i18n.pick(s, 'title') || s.title || i18n.t('tabbar.services');
  const localDesc = i18n.pick(s, 'description') || s.description || i18n.t('serviceDetail.defaultDesc');
  return {
    id: s.id,
    title: localTitle,
    titleEn: s.titleEn || '',
    description: localDesc,
    descriptionEn: s.descriptionEn || '',
    price: s.price,
    originPrice: s.originPrice,
    priceDisplay: formatPriceDisplay(s.price, sym),
    originPriceDisplay: showOrigin ? formatPriceDisplay(op, sym) : '',
    showOriginPrice: showOrigin,
  };
}

function buildCountryList() {
  return [
    i18n.t('country.cn'), i18n.t('country.hk'), i18n.t('country.mo'), i18n.t('country.tw'),
    i18n.t('country.us'), i18n.t('country.uk'), i18n.t('country.jp'), i18n.t('country.kr'),
    i18n.t('country.sg'), i18n.t('country.au'), i18n.t('country.ca'), i18n.t('country.de'),
    i18n.t('country.fr'), i18n.t('country.my'), i18n.t('country.th'), i18n.t('country.other'),
  ];
}
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
    region: [],
    detailAddress: '',
    remark: '',
    countryList: [],
    countryIndex: 0,
    loadingText: '',
    highlightsTitle: '',
    highlight1: '',
    highlight2: '',
    highlight3: '',
    highlight4: '',
    stepsTitle: '',
    step1: '',
    step2: '',
    step3: '',
    step4: '',
    step5: '',
    consultText: '',
    bookNowText: '',
    modalTitle: '',
    labelContact: '',
    labelPhone: '',
    labelCategory: '',
    labelProduct: '',
    labelSerial: '',
    labelMyProduct: '',
    labelCountry: '',
    labelCustomCountry: '',
    labelRegion: '',
    labelAddress: '',
    labelRemark: '',
    phContact: '',
    phPhone: '',
    phCategory: '',
    phProduct: '',
    phSerial: '',
    phMyProduct: '',
    phCountry: '',
    phCustomCountry: '',
    phRegion: '',
    phAddress: '',
    phRemark: '',
    totalLabel: '',
    confirmBookText: '',
    clearSelText: '',
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
    const self = this;
    const id = options.id;
    const doRefresh = () => {
      self.refreshI18n();
      self.setData({ serviceId: id });
      self.loadService(id);
    };
    if (i18n.isLoaded()) {
      doRefresh();
    } else {
      i18n.loadI18nTexts(doRefresh);
    }
  },

  refreshI18n() {
    i18n.setNavTitle('serviceDetail.title');
    const cl = buildCountryList();
    this.setData({
      countryList: cl,
      country: this.data.country || cl[0],
      loadingText: i18n.t('common.loading'),
      highlightsTitle: i18n.t('serviceDetail.highlights'),
      highlight1: i18n.t('serviceDetail.highlight1'),
      highlight2: i18n.t('serviceDetail.highlight2'),
      highlight3: i18n.t('serviceDetail.highlight3'),
      highlight4: i18n.t('serviceDetail.highlight4'),
      stepsTitle: i18n.t('serviceDetail.stepsTitle'),
      step1: i18n.t('serviceDetail.step1'),
      step2: i18n.t('serviceDetail.step2'),
      step3: i18n.t('serviceDetail.step3'),
      step4: i18n.t('serviceDetail.step4'),
      step5: i18n.t('serviceDetail.step5'),
      consultText: i18n.t('serviceDetail.consult'),
      bookNowText: i18n.t('serviceDetail.bookNow'),
      modalTitle: i18n.t('serviceDetail.modalTitle'),
      labelContact: i18n.t('serviceBook.contactName'),
      labelPhone: i18n.t('serviceBook.contactPhone'),
      labelCategory: i18n.t('serviceBook.category'),
      labelProduct: i18n.t('serviceBook.product'),
      labelSerial: i18n.t('serviceBook.serial'),
      labelMyProduct: i18n.t('serviceBook.fromMyProducts'),
      labelCountry: i18n.t('serviceBook.country'),
      labelCustomCountry: i18n.t('serviceBook.customCountry'),
      labelRegion: i18n.t('serviceBook.region'),
      labelAddress: i18n.t('serviceBook.address'),
      labelRemark: i18n.t('serviceBook.remark'),
      phContact: i18n.t('serviceBook.phContact'),
      phPhone: i18n.t('serviceBook.phPhone'),
      phCategory: i18n.t('serviceBook.phCategory'),
      phProduct: i18n.t('serviceBook.phProduct'),
      phSerial: i18n.t('serviceBook.phSerial'),
      phMyProduct: i18n.t('serviceBook.phMyProduct'),
      phCountry: i18n.t('serviceBook.phCountry'),
      phCustomCountry: i18n.t('serviceBook.phCustomCountry'),
      phRegion: i18n.t('serviceBook.phRegion'),
      phAddress: i18n.t('serviceBook.phAddress'),
      phRemark: i18n.t('serviceBook.phRemark'),
      totalLabel: i18n.t('serviceDetail.total'),
      confirmBookText: i18n.t('serviceDetail.confirmBook'),
      clearSelText: i18n.t('serviceBook.clearSelection'),
    });
  },

  loadService(id) {
    if (!id) {
      this.setData({ loading: false, serviceData: enrichServiceData(this.getFallbackService(1)) });
      return;
    }
    app.request({ url: `/services/${id}` })
      .then(res => {
        const s = res.data || {};
        // 透传原始 title/titleEn/description/descriptionEn，让 enrichServiceData 自己按语言 pick
        this.setData({
          loading: false,
          serviceData: enrichServiceData({
            id: s.id,
            title: s.title || '',
            titleEn: s.titleEn || '',
            description: s.description || '',
            descriptionEn: s.descriptionEn || '',
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
      1: { title: i18n.t('services.deviceRepair'), description: i18n.t('serviceDetail.fallbackDesc1'), price: '99', originPrice: '159' },
      2: { title: i18n.t('services.onsiteRepair'), description: i18n.t('serviceDetail.fallbackDesc2'), price: '149', originPrice: '199' },
      3: { title: i18n.t('services.remoteSupport'), description: i18n.t('serviceDetail.fallbackDesc3'), price: '29', originPrice: '49' },
      4: { title: i18n.t('services.deepClean'), description: i18n.t('serviceDetail.fallbackDesc4'), price: '149', originPrice: '199' },
      5: { title: i18n.t('services.dailyClean'), description: i18n.t('serviceDetail.fallbackDesc5'), price: '69', originPrice: '89' },
      6: { title: i18n.t('services.fullInspection'), description: i18n.t('serviceDetail.fallbackDesc6'), price: '49', originPrice: '79' },
      7: { title: i18n.t('services.performanceOpt'), description: i18n.t('serviceDetail.fallbackDesc7'), price: '79', originPrice: '129' },
      8: { title: i18n.t('services.dataRecovery'), description: i18n.t('serviceDetail.fallbackDesc8'), price: '199', originPrice: '299' },
      9: { title: i18n.t('services.dataBackup'), description: i18n.t('serviceDetail.fallbackDesc9'), price: '59', originPrice: '89' },
    };
    return map[id] || map[1];
  },

  onConsult() {
    const s = this.data.serviceData;
    const sym = app.globalData.currencySymbol || '¥';
    const lp = i18n.isEn() ? '(' : '\uff08';
    const rp = i18n.isEn() ? ')' : '\uff09';
    const lb = i18n.isEn() ? '[' : '\u3010';
    const rb = i18n.isEn() ? ']' : '\u3011';
    const col = i18n.isEn() ? ': ' : '\uff1a';
    const pricePart = Number(s.price) !== 0 && s.price != null && s.price !== ''
      ? lp + formatPriceDisplay(s.price, sym) + rp
      : '';
    const msg = i18n.t('serviceDetail.consultPrefix') + lb + (s.title || i18n.t('tabbar.services')) + rb + pricePart + (s.description ? col + s.description : '');
    wx.navigateTo({ url: '/pages/chat/chat?autoMsg=' + encodeURIComponent(msg) });
  },

  preventTouchMove() {},
  preventClose() {},

  /** 将 /auth/my-products 转为列表 + 下拉展示用文案 */
  buildMyProductsPickerPayload(res) {
    const list = (res && res.data) || [];
    const productSerialPickerLabels = list.map((p) => {
      const name = ((p && p.productName) || i18n.t('serviceBook.productLabel')).trim() || i18n.t('serviceBook.productLabel');
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
      country: i18n.t('country.cn'),
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
      let country = trimStr(a.country) || i18n.t('country.cn');
      let idx = list.indexOf(country);
      if (idx < 0) {
        country = i18n.t('country.cn');
        idx = 0;
      }
      let region = [];
      if (country === i18n.t('country.cn') && (a.province || a.city || a.district)) {
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
    if (country === i18n.t('country.other')) {
      parts.push(customCountry || i18n.t('country.other'));
    } else if (country) {
      parts.push(country);
    }
    if (country === i18n.t('country.cn') && region && region.length === 3 && (region[0] || region[1] || region[2])) {
      parts.push(region[0], region[1], region[2]);
    }
    if (detailAddress) parts.push(detailAddress);
    return parts.filter(Boolean).join(' ');
  },

  submitOrder() {
    const { contactName, contactPhone, country, customCountry, region, detailAddress, serviceData, productSerial, selectedCategoryId, selectedGuideId } = this.data;
    if (!selectedCategoryId) {
      wx.showToast({ title: i18n.t('serviceBook.errCategory'), icon: 'none' });
      return;
    }
    if (!selectedGuideId) {
      wx.showToast({ title: i18n.t('serviceBook.errProduct'), icon: 'none' });
      return;
    }
    if (!contactName || !contactName.trim()) {
      wx.showToast({ title: i18n.t('serviceBook.errContact'), icon: 'none' });
      return;
    }
    if (!contactPhone || !contactPhone.trim()) {
      wx.showToast({ title: i18n.t('serviceBook.errPhone'), icon: 'none' });
      return;
    }
    if (!country) {
      wx.showToast({ title: i18n.t('serviceBook.errCountry'), icon: 'none' });
      return;
    }
    if (country === i18n.t('country.other') && !(customCountry && customCountry.trim())) {
      wx.showToast({ title: i18n.t('serviceBook.errCustomCountry'), icon: 'none' });
      return;
    }
    if (country === i18n.t('country.cn') && (!region || region.length < 3 || !region[0])) {
      wx.showToast({ title: i18n.t('serviceBook.errRegion'), icon: 'none' });
      return;
    }
    if (!detailAddress || !detailAddress.trim()) {
      wx.showToast({ title: i18n.t('serviceBook.errAddress'), icon: 'none' });
      return;
    }

    const fullAddress = this.buildFullAddress();
    this.setData({ submitting: true });

    const payload = {
      serviceId: parseInt(this.data.serviceId, 10) || null,
      serviceTitle: serviceData.title || '',
      serviceTitleEn: serviceData.titleEn || '',
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
          title: i18n.t('serviceDetail.bookSuccess'),
          content: i18n.t('serviceDetail.bookSuccessMsg'),
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: '/pages/orders/orders' });
          },
        });
      })
      .catch(err => {
        this.setData({ submitting: false });
        wx.showToast({ title: err.message || i18n.t('serviceDetail.bookFailed'), icon: 'none' });
      });
  },
});
