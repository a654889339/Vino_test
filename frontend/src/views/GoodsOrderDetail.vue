<template>
  <div class="goods-order-detail">
    <van-nav-bar title="订单详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else-if="!order">
      <van-empty description="订单不存在" />
    </template>

    <template v-else>
      <van-cell-group inset>
        <van-cell title="订单号" :value="order.orderNo" />
        <van-cell title="状态">
          <template #value>
            <span :class="['status-tag', order.status]">{{ orderStatusText(order.status) }}</span>
          </template>
        </van-cell>
        <van-cell title="下单时间" :value="formatTime(order.createdAt)" />
        <van-cell title="联系人" :value="order.contactName" />
        <van-cell title="手机号" :value="order.contactPhone" />
        <van-cell title="地址" :label="order.address" />
        <van-cell v-if="order.remark" title="备注" :label="order.remark" />
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <van-cell title="商品明细" />
        <div v-for="it in order.items || []" :key="it.id" class="goods-item-row">
          <div class="goods-item-thumb">
            <img v-if="itemLineImage(it)" :src="fullUrl(itemLineImage(it))" alt="" />
            <van-icon v-else name="photo-o" size="28" color="#ccc" />
          </div>
          <div class="goods-item-body">
            <div class="goods-item-top">
              <span class="goods-item-name">{{ it.nameSnapshot }}</span>
              <span class="price goods-item-line">{{ formatPriceDisplay(it.lineTotal, it.currency) }}</span>
            </div>
            <div class="meta">{{ it.qty }} 件 · {{ formatPriceDisplay(it.unitPrice, it.currency) }}</div>
          </div>
        </div>
        <van-cell title="合计">
          <template #value>
            <span class="price">{{ formatPriceDisplay(order.totalPrice, order.currency) }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <div v-if="order.status === 'pending'" class="order-actions order-actions-stack">
        <van-button block round plain hairline type="default" @click="cancelOrder">取消订单</van-button>
        <van-button type="primary" color="#B91C1C" block round @click="payOrder">
          去支付
        </van-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showConfirmDialog } from 'vant';
import { goodsOrderApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';
import { resolveMediaUrl } from '@/utils/cosMedia.js';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const order = ref(null);

const mediaOpt = { apiBase: import.meta.env.VITE_API_BASE || '' };
function fullUrl(url) {
  return resolveMediaUrl(url, mediaOpt);
}
function itemLineImage(row) {
  if (!row) return '';
  return row.imageUrl || row.imageURL || '';
}

function formatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function orderStatusText(status) {
  const map = {
    pending: '待付款',
    paid: '已付款',
    processing: '处理中',
    completed: '已完成',
    cancelled: '已取消',
  };
  return map[status] || status;
}

function isWechatBrowser() {
  return /micromessenger/i.test(navigator.userAgent);
}

async function cancelOrder() {
  if (!order.value?.id) return;
  try {
    await showConfirmDialog({
      title: '取消订单',
      message: '确定取消？未支付订单取消后商品将回到购物车。',
    });
    const res = await goodsOrderApi.cancel(order.value.id);
    showToast(res.message || '已取消');
    await load();
  } catch (e) {
    if (e?.message && e.message !== 'cancel') {
      showToast(e.message);
    }
  }
}

async function payOrder() {
  if (!order.value || !order.value.id) return;
  if (!isWechatBrowser()) {
    showToast('请在微信内打开以完成支付');
    return;
  }
  try {
    const payRes = await goodsOrderApi.payWechat(order.value.id);
    const params = payRes.data;
    await new Promise((resolve, reject) => {
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
        reject(new Error('支付环境异常'));
      }
    });
    showToast('支付成功');
    load();
  } catch (e) {
    showToast(e?.message || '支付失败');
  }
}

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  const id = route.params.id;
  try {
    const res = await goodsOrderApi.detail(id);
    order.value = res.data || null;
  } catch {
    order.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.goods-order-detail {
  min-height: 100vh;
  background: var(--vino-bg, #f6f6f8);
  padding-bottom: 24px;
  box-sizing: border-box;
}
.page-loading {
  padding: 80px 0;
}
.mt12 {
  margin-top: 12px;
}
.goods-item-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 12px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  gap: 12px;
}
.goods-item-thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.goods-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.goods-item-body {
  flex: 1;
  min-width: 0;
}
.goods-item-top {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.goods-item-name {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.35;
  flex: 1;
}
.goods-item-line {
  flex-shrink: 0;
  font-size: 15px;
}
.meta {
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
}
.price {
  color: #b91c1c;
  font-weight: 800;
}
.status-tag {
  display: inline-block;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 600;
}
.status-tag.pending { background: #fef3c7; color: #92400e; }
.status-tag.paid { background: #dbeafe; color: #1e40af; }
.status-tag.processing { background: #e0e7ff; color: #3730a3; }
.status-tag.completed { background: #d1fae5; color: #065f46; }
.status-tag.cancelled { background: #f3f4f6; color: #4b5563; }
.order-actions {
  margin: 16px 16px 0;
}
.order-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>

