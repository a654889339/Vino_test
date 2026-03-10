<template>
  <div class="orders-page">
    <van-nav-bar title="我的订单" />

    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)" @change="onTabChange">
      <van-tab v-for="tab in tabs" :key="tab.key" :title="tab.name">
        <van-pull-refresh v-model="refreshing" @refresh="loadOrders">
          <van-loading v-if="loading" class="page-loading" size="28" vertical>加载中...</van-loading>
          <van-empty v-else-if="!orders.length" description="暂无订单" />
          <div v-else class="order-list">
            <div v-for="order in orders" :key="order.id" class="order-card">
              <div class="order-header">
                <span class="order-no">{{ order.orderNo }}</span>
                <van-tag :type="order.statusType" size="medium">{{ order.statusText }}</van-tag>
              </div>
              <div class="order-body">
                <div class="order-icon" :style="{ background: iconColor(order.serviceIcon) }">
                  <van-icon :name="order.serviceIcon || 'setting-o'" size="28" color="#fff" />
                </div>
                <div class="order-info">
                  <h4>{{ order.serviceTitle }}</h4>
                  <p>{{ formatTime(order.createdAt) }}</p>
                  <p v-if="order.contactName" class="order-contact">{{ order.contactName }} {{ order.contactPhone }}</p>
                </div>
                <span class="order-price">¥{{ order.price }}</span>
              </div>
              <div class="order-actions" v-if="order.status === 'pending'">
                <van-button size="small" plain @click="cancelOrder(order)">取消订单</van-button>
              </div>
            </div>
          </div>
        </van-pull-refresh>
      </van-tab>
    </van-tabs>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { orderApi } from '@/api';
import { showToast, showConfirmDialog } from 'vant';

const router = useRouter();
const activeTab = ref(0);
const loading = ref(true);
const refreshing = ref(false);
const orders = ref([]);

const tabs = [
  { key: 'all', name: '全部' },
  { key: 'pending', name: '待支付' },
  { key: 'processing', name: '进行中' },
  { key: 'completed', name: '已完成' },
];

const iconColors = {
  'setting-o': '#B91C1C', 'location-o': '#DC2626', 'phone-o': '#EF4444',
  'brush-o': '#2563EB', 'smile-o': '#3B82F6', 'scan': '#059669',
  'fire-o': '#10B981', 'replay': '#7C3AED', 'description': '#8B5CF6',
};
const iconColor = (icon) => iconColors[icon] || '#B91C1C';

const formatTime = (t) => {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const loadOrders = async () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    refreshing.value = false;
    orders.value = [];
    return;
  }
  try {
    const status = tabs[activeTab.value].key;
    const res = await orderApi.mine({ status });
    orders.value = res.data || [];
  } catch (err) {
    if (err.response?.status === 401) {
      showToast('请先登录');
      router.push('/login');
    }
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const onTabChange = () => {
  loading.value = true;
  orders.value = [];
  loadOrders();
};

const cancelOrder = async (order) => {
  try {
    await showConfirmDialog({ title: '取消订单', message: '确定要取消该订单吗？' });
    await orderApi.cancel(order.id);
    showToast('订单已取消');
    loadOrders();
  } catch { /* user cancelled dialog */ }
};

onMounted(loadOrders);
</script>

<style scoped>
.orders-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.page-loading {
  padding: 40px 0;
  text-align: center;
}

.order-list {
  padding: 12px 16px;
}

.order-card {
  background: var(--vino-card);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.order-no {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.order-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.order-info {
  flex: 1;
  min-width: 0;
}

.order-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.order-info p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.order-contact {
  margin-top: 2px;
}

.order-price {
  font-size: 16px;
  font-weight: 600;
  color: var(--vino-primary);
  flex-shrink: 0;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--vino-bg, #f5f5f5);
}
</style>
