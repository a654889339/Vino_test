<template>
  <div class="cart-page">
    <van-nav-bar title="购物车" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else-if="!lines.length">
      <van-empty description="购物车是空的">
        <van-button type="primary" round block class="cart-btn" @click="$router.push('/products')">
          去选购
        </van-button>
      </van-empty>
    </template>

    <template v-else>
      <div class="cart-list">
        <van-cell-group inset>
          <van-cell v-for="row in lines" :key="row.guideId" :title="row.name">
            <template #icon>
              <div class="cart-line-icon">
                <img v-if="cartLineImage(row)" :src="fullUrl(cartLineImage(row))" class="cart-line-img" alt="" />
                <van-icon v-else name="photo-o" size="36" color="#ccc" />
              </div>
            </template>
            <template #label>
              <div class="cart-line-label">
                <span class="cart-line-meta">
                  {{ formatPriceDisplay(row.listPrice, row.currency) || '未定价' }}
                </span>
                <span class="cart-line-del" @click.stop="removeLine(row.guideId)">删除</span>
              </div>
            </template>
            <template #right-icon>
              <van-stepper
                v-model="row.qty"
                integer
                :min="1"
                :max="9999"
                @change="onQtyChange"
              />
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <div class="app-fixed-bottom-shell">
        <div class="cart-bottom">
          <div class="cart-total">
            合计 <strong>{{ formatPriceDisplay(totalPrice, currencyHint) || '—' }}</strong>
          </div>
          <van-button type="primary" color="#B91C1C" block round class="cart-submit" @click="goCheckout">
            去结算
          </van-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { cartApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';

const router = useRouter();
const loading = ref(true);
const lines = ref([]);
const totalPrice = ref(0);

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

/** 后端 JSON 为 imageUrl；兼容历史/误写的 imageURL */
function cartLineImage(row) {
  if (!row) return '';
  return row.imageUrl || row.imageURL || '';
}

const currencyHint = computed(() => {
  const first = (lines.value || []).find((x) => x && x.currency);
  return first ? first.currency : null;
});

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  try {
    const res = await cartApi.get();
    const d = res.data || {};
    lines.value = Array.isArray(d.items) ? d.items : [];
    totalPrice.value = d.totalPrice || 0;
  } catch {
    lines.value = [];
    totalPrice.value = 0;
  } finally {
    loading.value = false;
  }
}

async function pushCartFromLines() {
  const items = (lines.value || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
  const res = await cartApi.put({ items });
  const d = res.data || {};
  lines.value = Array.isArray(d.items) ? d.items : [];
  totalPrice.value = d.totalPrice || 0;
}

let qtyTimer;
function onQtyChange() {
  clearTimeout(qtyTimer);
  qtyTimer = setTimeout(() => {
    pushCartFromLines().catch((e) => showToast(e.message || '更新失败'));
  }, 300);
}

async function removeLine(guideId) {
  const items = (lines.value || [])
    .filter((x) => Number(x.guideId) !== Number(guideId))
    .map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
  try {
    const res = await cartApi.put({ items });
    const d = res.data || {};
    lines.value = Array.isArray(d.items) ? d.items : [];
    totalPrice.value = d.totalPrice || 0;
    showToast('已删除');
  } catch (e) {
    showToast(e?.message || '删除失败');
  }
}

function goCheckout() {
  if (!lines.value.length) {
    showToast('购物车为空');
    return;
  }
  router.push('/checkout');
}

onMounted(load);
</script>

<style scoped>
.cart-page {
  min-height: 100vh;
  background: var(--vino-bg, #f6f6f8);
  padding-bottom: 120px;
  box-sizing: border-box;
}

.page-loading {
  padding: 80px 0;
}

.cart-list {
  padding: 12px 0;
}

.cart-line-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}
.cart-line-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cart-line-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cart-line-meta {
  font-size: 12px;
  color: #6b7280;
}
.cart-line-del {
  font-size: 12px;
  color: #ef4444;
  padding: 2px 6px;
  cursor: pointer;
}

.cart-bottom {
  position: relative;
  padding: 12px 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(248, 248, 250, 0.96));
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}

.cart-total {
  font-size: 15px;
  margin-bottom: 10px;
  color: #111827;
}

.cart-total strong {
  color: #b91c1c;
  font-size: 20px;
}

.cart-submit {
  font-weight: 600;
}

.cart-btn {
  margin-top: 16px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}
</style>

