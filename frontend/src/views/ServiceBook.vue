<template>
  <div class="book-page">
    <van-nav-bar :title="t('serviceBook.title')" left-arrow @click-left="goBack" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <div v-else-if="loadFailed" class="book-failed">
      <van-empty :description="t('服务信息加载失败，请稍后再试', 'Failed to load service info, please try again later.')" />
      <van-button plain type="primary" color="#B91C1C" round @click="goBack">{{ t('返回', 'Back') }}</van-button>
    </div>

    <template v-else>
      <div class="book-body">
        <div class="order-service-info">
          <div class="order-service-icon" :style="{ background: coverBg }">
            <img v-if="serviceIconUrl" :src="serviceIconUrl" class="order-service-icon-img" alt="" />
            <van-icon v-else :name="serviceIcon" size="24" color="#fff" />
          </div>
          <div>
            <h4>{{ pick(serviceData, 'title') }}</h4>
            <span class="order-service-price">{{ formatPriceDisplay(pick(serviceData, 'price'), servicePriceCurrencyOverride) }}</span>
          </div>
        </div>

        <div class="order-form-scroll">
          <div v-if="savedAddresses.length" class="saved-addr-section">
            <div class="saved-addr-title">
              <span>{{ t('serviceBook.pickAddr') }}</span>
              <span class="saved-addr-clear" v-if="selectedAddrId" @click="clearSelectedAddr">{{ t('serviceBook.clearSelection') }}</span>
            </div>
            <div class="saved-addr-list">
              <div
                v-for="addr in savedAddresses"
                :key="addr.id"
                class="saved-addr-item"
                :class="{ active: selectedAddrId === addr.id }"
                @click="applyAddress(addr)"
              >
                <div class="saved-addr-name">
                  {{ addr.contactName }} {{ addr.contactPhone }}
                  <van-tag v-if="addr.isDefault" type="primary" color="#B91C1C" size="mini">{{ t('serviceBook.tagDefault') }}</van-tag>
                </div>
                <div class="saved-addr-detail">{{ formatSavedAddr(addr) }}</div>
              </div>
            </div>
          </div>

          <van-cell-group inset>
            <van-field v-model="orderForm.contactName" :label="t('serviceBook.contact')" :placeholder="t('serviceBook.contactPh')" />
            <van-field v-model="orderForm.contactPhone" :label="t('serviceBook.phone')" type="tel" :placeholder="t('serviceBook.phonePh')" />
          </van-cell-group>

          <van-cell-group inset class="mt12">
            <div class="picker-trigger" @click="productFieldsLocked || (showCategoryPicker = !showCategoryPicker)">
              <span class="picker-label">{{ t('serviceBook.productCategory') }}</span>
              <span :class="['picker-value', { placeholder: !orderForm.categoryId, disabled: productFieldsLocked }]">
                {{ selectedCategoryName || t('serviceBook.productCategoryPh') }}
              </span>
              <van-icon v-if="!productFieldsLocked" :name="showCategoryPicker ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
              <van-icon v-else name="lock" class="picker-arrow" size="14" color="#999" />
            </div>
            <div v-if="showCategoryPicker" class="select-list">
              <div
                v-for="cat in productCategories"
                :key="cat.id"
                class="select-item"
                :class="{ active: orderForm.categoryId === cat.id }"
                @click="selectCategory(cat)"
              >
                <span>{{ pick(cat, 'name') }}</span>
                <van-icon v-if="orderForm.categoryId === cat.id" name="success" color="#B91C1C" size="16" />
              </div>
            </div>
          </van-cell-group>

          <van-cell-group inset class="mt12" v-if="orderForm.categoryId">
            <div class="picker-trigger" @click="productFieldsLocked || (showGuidePicker = !showGuidePicker)">
              <span class="picker-label">{{ t('serviceBook.productGuide') }}</span>
              <span :class="['picker-value', { placeholder: !orderForm.guideId, disabled: productFieldsLocked }]">
                {{ selectedGuideName || t('serviceBook.productGuidePh') }}
              </span>
              <van-icon v-if="!productFieldsLocked" :name="showGuidePicker ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
              <van-icon v-else name="lock" class="picker-arrow" size="14" color="#999" />
            </div>
            <div v-if="showGuidePicker" class="select-list">
              <div
                v-for="g in filteredGuides"
                :key="g.id"
                class="select-item"
                :class="{ active: orderForm.guideId === g.id }"
                @click="selectGuide(g)"
              >
                <span>{{ pick(g, 'name') }}</span>
                <van-icon v-if="orderForm.guideId === g.id" name="success" color="#B91C1C" size="16" />
              </div>
            </div>
          </van-cell-group>

          <van-cell-group inset class="mt12">
            <van-field
              v-model="orderForm.productSerial"
              :label="t('serviceBook.serial')"
              :placeholder="t('serviceBook.serialPh')"
              maxlength="128"
              :disabled="productFieldsLocked"
            />
          </van-cell-group>

          <div v-if="myProducts.length" class="saved-addr-section">
            <div class="saved-addr-title">
              <span>{{ t('serviceBook.fromMyProducts') }}</span>
              <span v-if="productFieldsLocked" class="saved-addr-clear" @click="unlockProductFields">{{ t('serviceBook.clearSelection') }}</span>
            </div>
            <div class="saved-addr-list">
              <div
                v-for="p in myProducts"
                :key="p.productKey"
                class="saved-addr-item"
                :class="{ active: orderForm.productSerial === p.productKey && productFieldsLocked }"
                @click="applyMyProduct(p)"
              >
                <div class="my-product-row">
                  <div class="my-product-info">
                    <div class="saved-addr-name">
                      {{ p.productName }}
                      <van-tag v-if="p.categoryName" type="primary" color="#B91C1C" size="mini" plain>{{ p.categoryName }}</van-tag>
                    </div>
                    <div class="saved-addr-detail" style="font-family:monospace;font-size:12px">{{ p.productKey }}</div>
                  </div>
                  <img v-if="p.iconUrl" :src="p.iconUrl" class="my-product-icon" alt="" />
                </div>
              </div>
            </div>
          </div>

          <van-cell-group inset class="mt12">
            <div class="picker-trigger" @click="showInlineCountry = !showInlineCountry; showInlineArea = false">
              <span class="picker-label">{{ t('serviceBook.country') }}</span>
              <span :class="['picker-value', { placeholder: !orderForm.country }]">
                {{ countryDisplay || t('serviceBook.countryPh') }}
              </span>
              <van-icon :name="showInlineCountry ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
            </div>
            <div v-if="showInlineCountry" class="select-list">
              <div
                v-for="c in countryColumns"
                :key="c"
                class="select-item"
                :class="{ active: orderForm.country === c }"
                @click="selectCountry(c)"
              >
                <span>{{ c }}</span>
                <van-icon v-if="orderForm.country === c" name="success" color="#B91C1C" size="16" />
              </div>
            </div>

            <van-field
              v-if="orderForm.country === t('country.other')"
              v-model="orderForm.customCountry"
              :label="t('serviceBook.customCountry')"
              :placeholder="t('serviceBook.customCountryPh')"
            />

            <template v-if="orderForm.country === t('country.cn')">
              <div class="picker-trigger" @click="showInlineArea = !showInlineArea; showInlineCountry = false">
                <span class="picker-label">{{ t('serviceBook.area') }}</span>
                <span :class="['picker-value', { placeholder: !orderForm.province }]">
                  {{ areaDisplay || t('serviceBook.areaPh') }}
                </span>
                <van-icon :name="showInlineArea ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
              </div>
              <div v-if="showInlineArea" class="area-picker-wrap" @touchmove.stop @mousewheel.stop>
                <van-area
                  :area-list="areaList"
                  @confirm="onAreaConfirm"
                  @cancel="showInlineArea = false"
                />
              </div>
            </template>
          </van-cell-group>

          <van-cell-group inset class="mt12">
            <van-field v-model="orderForm.detailAddress" :label="t('serviceBook.detail')" :placeholder="t('serviceBook.detailPh')" />
            <van-field v-model="orderForm.remark" :label="t('serviceBook.remark')" type="textarea" rows="2" :placeholder="t('serviceBook.remarkPh')" />
          </van-cell-group>
        </div>

        <div class="order-submit-area">
          <div class="order-total">
            <span>{{ t('serviceBook.total') }}</span>
            <span v-if="shouldShowPrice(pick(serviceData, 'price'))" class="order-total-price">{{ formatPriceDisplay(pick(serviceData, 'price'), servicePriceCurrencyOverride) }}</span>
          </div>
          <van-button type="primary" color="#B91C1C" block round :loading="submitting" @click="submitOrder">
            {{ t('serviceBook.submit') }}
          </van-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { serviceApi, orderApi, addressApi, authApi, guideApi } from '@/api';
import { showToast, showDialog } from 'vant';
import { formatPriceDisplay, shouldShowPrice } from '@/utils/currency';
import { pick, t } from '@/utils/i18n';
import { areaList } from '@vant/area-data';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const submitting = ref(false);
const showInlineCountry = ref(false);
const showInlineArea = ref(false);
const savedAddresses = ref([]);
const selectedAddrId = ref(null);
const myProducts = ref([]);
const productCategories = ref([]);
const allGuides = ref([]);
const showCategoryPicker = ref(false);
const showGuidePicker = ref(false);
const productFieldsLocked = ref(false);

const countryColumns = [
  t('country.cn'), t('country.hk'), t('country.mo'), t('country.tw'),
  t('country.us'), t('country.uk'), t('country.jp'), t('country.kr'), t('country.sg'), t('country.au'),
  t('country.ca'), t('country.de'), t('country.fr'), t('country.my'), t('country.th'), t('country.other'),
];

const orderForm = reactive({
  contactName: '',
  contactPhone: '',
  country: '',
  customCountry: '',
  province: '',
  city: '',
  district: '',
  areaCode: '',
  detailAddress: '',
  remark: '',
  productSerial: '',
  categoryId: null,
  guideId: null,
});

const selectedCategoryName = computed(() => {
  if (!orderForm.categoryId) return '';
  const cat = productCategories.value.find(c => c.id === orderForm.categoryId);
  return cat ? pick(cat, 'name') : '';
});

const selectedGuideName = computed(() => {
  if (!orderForm.guideId) return '';
  const g = allGuides.value.find(x => x.id === orderForm.guideId);
  return g ? pick(g, 'name') : '';
});

const filteredGuides = computed(() => {
  if (!orderForm.categoryId) return [];
  return allGuides.value.filter(g => g.categoryId === orderForm.categoryId);
});

const selectCategory = (cat) => {
  orderForm.categoryId = cat.id;
  orderForm.guideId = null;
  showCategoryPicker.value = false;
  showGuidePicker.value = false;
};

const selectGuide = (g) => {
  orderForm.guideId = g.id;
  showGuidePicker.value = false;
};

const applyMyProduct = (p) => {
  if (p.categoryId) orderForm.categoryId = p.categoryId;
  if (p.guideId) orderForm.guideId = p.guideId;
  orderForm.productSerial = p.productKey || '';
  productFieldsLocked.value = true;
  showCategoryPicker.value = false;
  showGuidePicker.value = false;
};

const unlockProductFields = () => {
  productFieldsLocked.value = false;
  orderForm.categoryId = null;
  orderForm.guideId = null;
  orderForm.productSerial = '';
};

const countryDisplay = computed(() => {
  if (orderForm.country === t('country.other') && orderForm.customCountry) return `${t('country.other')} - ${orderForm.customCountry}`;
  return orderForm.country || '';
});

const areaDisplay = computed(() => {
  if (orderForm.province) return `${orderForm.province} ${orderForm.city} ${orderForm.district}`.trim();
  return '';
});

const selectCountry = (c) => {
  orderForm.country = c;
  orderForm.province = '';
  orderForm.city = '';
  orderForm.district = '';
  orderForm.areaCode = '';
  orderForm.customCountry = '';
  showInlineCountry.value = false;
};

const onAreaConfirm = ({ selectedOptions }) => {
  orderForm.province = selectedOptions[0]?.text || '';
  orderForm.city = selectedOptions[1]?.text || '';
  orderForm.district = selectedOptions[2]?.text || '';
  orderForm.areaCode = selectedOptions[2]?.value || '';
  showInlineArea.value = false;
};

const buildFullAddress = () => {
  const parts = [];
  if (orderForm.country === t('country.other')) {
    parts.push(orderForm.customCountry || t('country.other'));
  } else if (orderForm.country) {
    parts.push(orderForm.country);
  }
  if (orderForm.country === t('country.cn') && orderForm.province) {
    parts.push(orderForm.province, orderForm.city, orderForm.district);
  }
  if (orderForm.detailAddress) parts.push(orderForm.detailAddress);
  return parts.filter(Boolean).join(' ');
};

const formatSavedAddr = (addr) => {
  const parts = [];
  if (addr.country === t('country.other')) parts.push(addr.customCountry || t('country.other'));
  else if (addr.country) parts.push(addr.country);
  if (addr.country === t('country.cn')) {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
};

const applyAddress = (addr) => {
  selectedAddrId.value = addr.id;
  orderForm.contactName = addr.contactName;
  orderForm.contactPhone = addr.contactPhone;
  orderForm.country = addr.country;
  orderForm.customCountry = addr.customCountry || '';
  orderForm.province = addr.province || '';
  orderForm.city = addr.city || '';
  orderForm.district = addr.district || '';
  orderForm.detailAddress = addr.detailAddress || '';
  showInlineCountry.value = false;
  showInlineArea.value = false;
};

const clearSelectedAddr = () => {
  selectedAddrId.value = null;
  orderForm.contactName = '';
  orderForm.contactPhone = '';
  orderForm.country = '';
  orderForm.customCountry = '';
  orderForm.province = '';
  orderForm.city = '';
  orderForm.district = '';
  orderForm.areaCode = '';
  orderForm.detailAddress = '';
};

const loadSavedAddresses = async () => {
  try {
    const res = await addressApi.list();
    savedAddresses.value = res.data || [];
  } catch {}
};

const loadMyProducts = async () => {
  try {
    const res = await authApi.myProducts();
    myProducts.value = res.data || [];
  } catch {
    myProducts.value = [];
  }
};

const loadProductCategoriesAndGuides = async () => {
  try {
    const [catRes, guideRes] = await Promise.all([guideApi.categories(), guideApi.list()]);
    productCategories.value = catRes.data || [];
    allGuides.value = (guideRes.data || []).map(g => ({ ...g, id: g.id, name: g.name, categoryId: g.categoryId }));
  } catch {
    productCategories.value = [];
    allGuides.value = [];
  }
};

// 禁止在前端维护任何 fallback 价格：后端已将 services 表作为订单金额的**唯一真值**，
// 若前端拿不到最新详情就让用户看到加载失败提示并返回，避免下单时展示价与实际不一致。
const serviceData = ref({ title: '', description: '', price: '0' });
const serviceIcon = ref('setting-o');
const serviceIconUrl = ref('');
const coverBg = ref('linear-gradient(135deg, #B91C1C, #7F1D1D)');
const loadFailed = ref(false);

const servicePriceCurrencyOverride = computed(() => {
  const c = pick(serviceData.value, 'currency');
  return c && String(c).trim() ? String(c).trim() : null;
});

const goBack = () => {
  const id = route.params.id;
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace(`/service/${id}`);
  }
};

onMounted(async () => {
  const id = route.params.id;
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showDialog({ title: t('serviceDetail.loginTitle'), message: t('serviceDetail.loginMsg') }).then(() => {
      router.replace({ path: '/login', query: { redirect: `/service/${id}/book` } });
    });
    return;
  }

  showInlineCountry.value = false;
  showInlineArea.value = false;
  orderForm.productSerial = '';
  orderForm.categoryId = null;
  orderForm.guideId = null;
  productFieldsLocked.value = false;
  await Promise.all([loadSavedAddresses(), loadMyProducts(), loadProductCategoriesAndGuides()]);

  try {
    const res = await serviceApi.detail(id);
    const d = res.data || {};
    if (!d.id || !(Number(d.price) > 0) || d.status === 'inactive') {
      loadFailed.value = true;
      return;
    }
    serviceData.value = { ...d };
    serviceIcon.value = d.icon || 'setting-o';
    serviceIconUrl.value = d.iconUrl || '';
    coverBg.value = d.bg || 'linear-gradient(135deg, #B91C1C, #7F1D1D)';
  } catch {
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
});

const submitOrder = async () => {
  if (!orderForm.categoryId) { showToast(t('serviceBook.productCategoryPh')); return; }
  if (!orderForm.guideId) { showToast(t('serviceBook.productGuidePh')); return; }
  if (!orderForm.contactName.trim()) { showToast(t('serviceBook.contactPh')); return; }
  if (!orderForm.contactPhone.trim()) { showToast(t('serviceBook.phonePh')); return; }
  if (!orderForm.country) { showToast(t('serviceBook.countryPh')); return; }
  if (orderForm.country === t('country.other') && !orderForm.customCountry.trim()) { showToast(t('serviceBook.customCountryPh')); return; }
  if (orderForm.country === t('country.cn') && !orderForm.province) { showToast(t('serviceBook.areaPh')); return; }
  if (!orderForm.detailAddress.trim()) { showToast(t('serviceBook.detailPh')); return; }

  const fullAddress = buildFullAddress();
  submitting.value = true;
  try {
    // 注意：serviceTitle / price / serviceIcon 由后端按 serviceId 查 services 表强制赋值，
    // 前端不再上送这些字段，避免任何错觉。
    const svcId = Number(route.params.id);
    if (!svcId || svcId <= 0) {
      showToast(t('服务信息异常，请返回重试', 'Invalid service, please go back.'));
      return;
    }
    await orderApi.create({
      serviceId: svcId,
      contactName: orderForm.contactName.trim(),
      contactPhone: orderForm.contactPhone.trim(),
      address: fullAddress,
      remark: orderForm.remark.trim(),
      productSerial: orderForm.productSerial.trim(),
      guideId: orderForm.guideId,
    });
    showDialog({ title: t('serviceBook.successTitle'), message: t('serviceBook.successMsg') }).then(() => {
      router.push('/orders');
    });
  } catch (err) {
    showToast(err.message || t('serviceBook.orderFailed'));
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.book-page {
  background: var(--vino-bg);
  min-height: 100vh;
  padding-bottom: 24px;
}

.page-loading {
  padding-top: 120px;
  text-align: center;
}

.book-failed {
  padding-top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.book-failed .van-button { min-width: 120px; }

.book-body {
  padding: 12px 0 0;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 46px);
}

.order-service-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 0 16px 16px;
  background: var(--vino-bg, #f7f7f7);
  border-radius: 10px;
  flex-shrink: 0;
}

.order-service-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.order-service-icon-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.order-service-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.order-service-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
}

.order-form-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}

.mt12 {
  margin-top: 12px;
}

.picker-trigger {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  min-height: 44px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.picker-label {
  font-size: 14px;
  color: #323233;
  width: 6.2em;
  flex-shrink: 0;
  margin-right: 12px;
}

.picker-value {
  flex: 1;
  font-size: 14px;
  color: #323233;
  text-align: right;
}

.picker-value.placeholder {
  color: #c8c9cc;
}

.picker-value.disabled {
  color: #999;
  opacity: 0.7;
}

.picker-arrow {
  margin-left: 4px;
  color: #969799;
  flex-shrink: 0;
}

.select-list {
  max-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid #f0f0f0;
}

.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 14px;
  color: #323233;
  border-bottom: 1px solid #fafafa;
  cursor: pointer;
  transition: background 0.15s;
}

.select-item:active {
  background: #f5f5f5;
}

.select-item.active {
  color: #B91C1C;
  font-weight: 500;
}

.area-picker-wrap {
  border-bottom: 1px solid #f0f0f0;
  height: 260px;
  overflow: hidden;
}

.saved-addr-section {
  padding: 0 16px 8px;
}
.saved-addr-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  padding-top: 4px;
}
.saved-addr-clear {
  font-size: 12px;
  color: #B91C1C;
  cursor: pointer;
}
.saved-addr-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.saved-addr-item {
  background: #f9f9f9;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color .15s;
}
.saved-addr-item.active {
  border-color: #B91C1C;
  background: #fff5f5;
}
.saved-addr-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.saved-addr-detail {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.my-product-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.my-product-info {
  flex: 1;
  min-width: 0;
}
.my-product-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 8px;
  flex-shrink: 0;
  background: #f0f0f0;
}

.order-submit-area {
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.order-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.order-total-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
  margin-left: 4px;
}
</style>
