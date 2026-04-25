<template>
  <div class="checkout-page">
    <van-nav-bar title="确认订单" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else>
      <template v-if="!lines.length">
        <van-empty description="购物车为空">
          <van-button type="primary" round block class="back-btn" @click="$router.push('/products')">
            去选购
          </van-button>
        </van-empty>
      </template>

      <template v-else>
        <van-cell-group inset>
          <template v-if="selectedAddress">
            <van-cell is-link @click="showAddressSheet = true">
              <template #title>
                <div class="addr-row">
                  <span class="addr-name">{{ selectedAddress.contactName }}</span>
                  <span class="addr-phone">{{ selectedAddress.contactPhone }}</span>
                </div>
                <div class="addr-line">{{ formatAddressLine(selectedAddress) }}</div>
              </template>
              <template #value>
                <span class="addr-change">更换</span>
              </template>
            </van-cell>
          </template>
          <template v-else>
            <van-cell is-link @click="goAddAddress">
              <template #title>
                <span class="addr-empty">暂无收货地址，去添加</span>
              </template>
            </van-cell>
          </template>
        </van-cell-group>

        <van-cell-group inset class="mt12">
          <van-cell title="联系人">
            <template #value>
              <input v-model.trim="form.contactName" class="inline-input" placeholder="请输入姓名" />
            </template>
          </van-cell>
          <van-cell title="手机号">
            <template #value>
              <input v-model.trim="form.contactPhone" class="inline-input" placeholder="请输入手机号" />
            </template>
          </van-cell>
          <van-cell title="地址">
            <template #value>
              <textarea v-model.trim="form.address" class="inline-textarea" placeholder="请输入详细地址" />
            </template>
          </van-cell>
          <van-cell title="备注">
            <template #value>
              <input v-model.trim="form.remark" class="inline-input" placeholder="可选" />
            </template>
          </van-cell>
        </van-cell-group>

        <van-cell-group inset class="mt12">
          <van-cell title="商品明细" />
          <van-cell v-for="row in lines" :key="row.guideId" :title="row.name">
            <template #label>
              <span class="meta">{{ row.qty }} 件 · {{ formatPriceDisplay(row.listPrice, row.currency) }}</span>
            </template>
            <template #value>
              <span class="line-total">{{ formatPriceDisplay(row.lineTotal, row.currency) }}</span>
            </template>
          </van-cell>
        </van-cell-group>

        <div class="app-fixed-bottom-shell">
          <div class="checkout-bottom">
            <div class="total">
              合计 <strong>{{ formatPriceDisplay(totalPrice, currencyHint) || '—' }}</strong>
            </div>
            <van-button
              type="primary"
              color="#B91C1C"
              block
              round
              :loading="submitting"
              :disabled="createGoodsOrderDisabled"
              @click="submit"
            >
              提交订单
            </van-button>
            <div v-if="createGoodsOrderDisabled" class="disabled-tip">
              {{ createGoodsOrderDisabledText }}
            </div>
          </div>
        </div>

        <van-action-sheet v-model:show="showAddressSheet" title="选择收货地址">
          <div class="addr-sheet-list">
            <div
              v-for="addr in addresses"
              :key="addr.id"
              class="addr-sheet-item"
              :class="{ active: selectedAddress && selectedAddress.id === addr.id }"
              @click="selectAddress(addr)"
            >
              <div class="addr-sheet-top">
                <span class="addr-sheet-name">{{ addr.contactName }}</span>
                <span class="addr-sheet-phone">{{ addr.contactPhone }}</span>
                <van-tag v-if="addr.isDefault" type="primary" color="#B91C1C" size="mini">默认</van-tag>
              </div>
              <div class="addr-sheet-detail">{{ formatAddressLine(addr) }}</div>
            </div>
            <div class="addr-sheet-add" @click="goAddAddress">
              <van-icon name="plus" size="16" />
              <span>新增地址</span>
            </div>
          </div>
        </van-action-sheet>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { cartApi, goodsOrderApi, addressApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';

const router = useRouter();
const loading = ref(true);
const submitting = ref(false);
const showAddressSheet = ref(false);
const injectedStatus = inject('appStatus', null);

const lines = ref([]);
const totalPrice = ref(0);
const addresses = ref([]);
const selectedAddress = ref(null);

const currencyHint = computed(() => {
  const first = (lines.value || []).find((x) => x && x.currency);
  return first ? first.currency : null;
});

const createGoodsOrderDisabled = computed(() => {
  const s = injectedStatus && injectedStatus.value ? injectedStatus.value : null;
  if (!s) return false;
  return s.enableCreateGoodsOrder === false;
});
const createGoodsOrderDisabledText = computed(() => t('当前已关闭商品下单功能，请稍后再试。', 'Goods order creation is currently disabled. Please try again later.'));

const form = reactive({
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
});

function formatAddressLine(addr) {
  const parts = [];
  if (addr.country === t('country.other')) {
    parts.push(addr.customCountry || t('country.other'));
  } else if (addr.country) {
    parts.push(addr.country);
  }
  if (addr.country === t('country.cn')) {
    if (addr.province) parts.push(addr.province);
    if (addr.city) parts.push(addr.city);
    if (addr.district) parts.push(addr.district);
  }
  if (addr.detailAddress) parts.push(addr.detailAddress);
  return parts.join(' ');
}

function applyAddress(addr) {
  selectedAddress.value = addr;
  form.contactName = addr.contactName || '';
  form.contactPhone = addr.contactPhone || '';
  form.address = formatAddressLine(addr);
}

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  try {
    const [cartRes, addrRes] = await Promise.all([
      cartApi.get(),
      addressApi.list().catch(() => ({ data: [] })),
    ]);
    const d = cartRes.data || {};
    lines.value = Array.isArray(d.items) ? d.items : [];
    totalPrice.value = d.totalPrice || 0;

    addresses.value = Array.isArray(addrRes.data) ? addrRes.data : [];
    const def = addresses.value.find((a) => a.isDefault);
    if (def) {
      applyAddress(def);
    } else if (addresses.value.length) {
      applyAddress(addresses.value[0]);
    }
  } catch {
    lines.value = [];
    totalPrice.value = 0;
    addresses.value = [];
  } finally {
    loading.value = false;
  }
}

function goAddAddress() {
  router.push('/address/add');
}

function selectAddress(addr) {
  applyAddress(addr);
  showAddressSheet.value = false;
}

function isWechatBrowser() {
  return /micromessenger/i.test(navigator.userAgent);
}

function invokeWechatPay(params) {
  return new Promise((resolve, reject) => {
    if (typeof WeixinJSBridge !== 'undefined') {
      WeixinJSBridge.invoke('getBrandWCPayRequest', params, (res) => {
        if (res.err_msg === 'get_brand_wcpay_request:ok') {
          resolve('ok');
        } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
          reject(new Error('用户取消支付'));
        } else {
          reject(new Error(res.err_msg || '支付失败'));
        }
      });
    } else {
      reject(new Error('请在微信内打开以完成支付'));
    }
  });
}

function digitsOnlyPhone(s) {
  return String(s || '').replace(/\D/g, '');
}

function normalizeSubmitPhone(s) {
  const d = digitsOnlyPhone(s);
  if (d.length >= 11 && d[d.length - 11] === '1') return d.slice(-11);
  return d;
}

async function submit() {
  if (createGoodsOrderDisabled.value) {
    showToast(createGoodsOrderDisabledText.value);
    return;
  }
  if (!lines.value.length) {
    showToast('购物车为空');
    return;
  }
  if (!form.contactName.trim() || !form.contactPhone.trim()) {
    showToast('请填写联系人和手机号');
    return;
  }
  if (!form.address.trim()) {
    showToast('请填写地址');
    return;
  }
  const phoneNorm = normalizeSubmitPhone(form.contactPhone);
  if (phoneNorm.length !== 11 || phoneNorm[0] !== '1') {
    showToast('请输入正确的11位大陆手机号');
    return;
  }
  submitting.value = true;
  try {
    const res = await goodsOrderApi.checkout({
      contactName: form.contactName.trim(),
      contactPhone: phoneNorm,
      address: form.address.trim(),
      remark: form.remark.trim(),
    });
    const order = res.data;
    if (isWechatBrowser() && order && order.id) {
      try {
        const payRes = await goodsOrderApi.payWechat(order.id);
        await invokeWechatPay(payRes.data);
        showToast('支付成功');
        router.replace(`/goods-orders/${order.id}`);
        return;
      } catch (payErr) {
        showToast(payErr?.message || '支付未完成');
        router.replace(`/goods-orders/${order.id}`);
        return;
      }
    }
    showToast('下单成功');
    router.replace('/goods-orders');
  } catch (e) {
    const msg =
      e?.response?.data?.message ||
      e?.response?.data?.Message ||
      e?.message ||
      '下单失败';
    showToast(msg);
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.checkout-page {
  min-height: 100vh;
  background: var(--vino-bg, #f6f6f8);
  padding-bottom: 120px;
  box-sizing: border-box;
}

.page-loading {
  padding: 80px 0;
}

.mt12 {
  margin-top: 12px;
}

.inline-input {
  width: 100%;
  border: none;
  outline: none;
  text-align: right;
  background: transparent;
  color: #111827;
}

.inline-textarea {
  width: 100%;
  min-height: 60px;
  border: none;
  outline: none;
  resize: none;
  text-align: right;
  background: transparent;
  color: #111827;
}

.meta {
  font-size: 12px;
  color: #6b7280;
}

.line-total {
  color: #b91c1c;
  font-weight: 700;
}

.checkout-bottom {
  padding: 12px 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(248, 248, 250, 0.96));
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}

.total {
  font-size: 15px;
  margin-bottom: 10px;
  color: #111827;
}

.total strong {
  color: #b91c1c;
  font-size: 20px;
}

.disabled-tip {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: #b91c1c;
}

.back-btn {
  margin-top: 16px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}

.addr-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.addr-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.addr-phone {
  font-size: 14px;
  color: #6b7280;
}

.addr-line {
  margin-top: 4px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.addr-empty {
  font-size: 14px;
  color: #b91c1c;
  font-weight: 500;
}

.addr-change {
  font-size: 13px;
  color: #b91c1c;
}

.addr-sheet-list {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.addr-sheet-item {
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.addr-sheet-item.active {
  background: #fef2f2;
  margin: 0 -16px;
  padding: 14px 16px;
}

.addr-sheet-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.addr-sheet-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.addr-sheet-phone {
  font-size: 13px;
  color: #6b7280;
}

.addr-sheet-detail {
  margin-top: 4px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.addr-sheet-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 0;
  color: #b91c1c;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
</style>

