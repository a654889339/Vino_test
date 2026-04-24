<template>
  <div class="goods-orders-page">
    <van-nav-bar title="商品订单" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else-if="!list.length">
      <van-empty description="暂无订单" />
    </template>

    <template v-else>
      <van-cell-group inset>
        <van-cell
          v-for="o in list"
          :key="o.id"
          :title="o.orderNo"
          is-link
          @click="open(o)"
        >
          <template #label>
            <span :class="['status-tag', o.status]">{{ orderStatusText(o.status) }}</span>
            <span class="order-time">{{ formatTime(o.createdAt) }}</span>
          </template>
          <template #value>
            <span class="price">{{ formatPriceDisplay(o.totalPrice, o.currency) }}</span>
          </template>
        </van-cell>
      </van-cell-group>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { goodsOrderApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';

const router = useRouter();
const loading = ref(true);
const list = ref([]);

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

function open(o) {
  router.push(`/goods-orders/${o.id}`);
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
    const res = await goodsOrderApi.list({ page: 1, pageSize: 50 });
    list.value = res.data?.list || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.goods-orders-page {
  min-height: 100vh;
  background: var(--vino-bg, #f6f6f8);
  padding-bottom: 24px;
  box-sizing: border-box;
}
.page-loading {
  padding: 80px 0;
}
.price {
  color: #b91c1c;
  font-weight: 800;
}
.status-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  margin-right: 8px;
  font-weight: 600;
}
.status-tag.pending { background: #fef3c7; color: #92400e; }
.status-tag.paid { background: #dbeafe; color: #1e40af; }
.status-tag.processing { background: #e0e7ff; color: #3730a3; }
.status-tag.completed { background: #d1fae5; color: #065f46; }
.status-tag.cancelled { background: #f3f4f6; color: #4b5563; }
.order-time {
  font-size: 12px;
  color: #6b7280;
}
</style>

