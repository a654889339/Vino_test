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
        <van-cell title="状态" :value="order.status" />
        <van-cell title="下单时间" :value="formatTime(order.createdAt)" />
        <van-cell title="联系人" :value="order.contactName" />
        <van-cell title="手机号" :value="order.contactPhone" />
        <van-cell title="地址" :label="order.address" />
        <van-cell v-if="order.remark" title="备注" :label="order.remark" />
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <van-cell title="商品明细" />
        <van-cell v-for="it in order.items || []" :key="it.id" :title="it.nameSnapshot">
          <template #label>
            <span class="meta">{{ it.qty }} 件 · {{ formatPriceDisplay(it.unitPrice, it.currency) }}</span>
          </template>
          <template #value>
            <span class="price">{{ formatPriceDisplay(it.lineTotal, it.currency) }}</span>
          </template>
        </van-cell>
        <van-cell title="合计">
          <template #value>
            <span class="price">{{ formatPriceDisplay(order.totalPrice, order.currency) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { goodsOrderApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const order = ref(null);

function formatTime(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
.meta {
  font-size: 12px;
  color: #6b7280;
}
.price {
  color: #b91c1c;
  font-weight: 800;
}
</style>

