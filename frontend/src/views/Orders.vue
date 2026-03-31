<template>
  <div class="orders-page">
    <PageThemeLayer path="/orders" />
    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)" @change="onTabChange">
      <van-tab v-for="tab in tabs" :key="tab.key" :title="tab.name">
        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <van-loading v-if="firstLoading" class="page-loading" size="28" vertical>{{ t('common.loading') }}</van-loading>
          <van-empty v-else-if="!orders.length && !loadingMore" :description="t('orders.empty')" />
          <van-list
            v-else
            v-model:loading="loadingMore"
            :finished="finished"
            :finished-text="t('orders.noMore')"
            @load="loadMore"
          >
            <div class="order-list">
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
                  <span v-if="shouldShowPrice(order.price)" class="order-price">{{ formatPriceDisplay(order.price) }}</span>
                </div>
                <div class="order-actions" v-if="order.status === 'pending'">
                  <van-button size="small" plain @click="cancelOrder(order)">{{ t('orders.cancel') }}</van-button>
                </div>
              </div>
            </div>
          </van-list>
        </van-pull-refresh>
      </van-tab>
    </van-tabs>

    <div style="height: 96px;"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { orderApi } from '@/api';
import { showToast, showConfirmDialog } from 'vant';
import { formatPriceDisplay, shouldShowPrice } from '@/utils/currency';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import { t } from '@/utils/i18n';

const router = useRouter();
const activeTab = ref(0);
const firstLoading = ref(true);
const refreshing = ref(false);
const loadingMore = ref(false);
const finished = ref(false);
const orders = ref([]);
let currentPage = 1;
const pageSize = 10;

const tabs = computed(() => [
  { key: 'all', name: t('orders.all') },
  { key: 'pending', name: t('orders.pendingPay') },
  { key: 'paid', name: t('orders.paid') },
  { key: 'processing', name: t('orders.processing') },
  { key: 'completed', name: t('orders.completed') },
]);

const iconColors = {
  'setting-o': '#B91C1C', 'location-o': '#DC2626', 'phone-o': '#EF4444',
  'brush-o': '#2563EB', 'smile-o': '#3B82F6', 'scan': '#059669',
  'fire-o': '#10B981', 'replay': '#7C3AED', 'description': '#8B5CF6',
};
const iconColor = (icon) => iconColors[icon] || '#B91C1C';

const formatTime = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fetchOrders = async (page) => {
  const token = localStorage.getItem('vino_token');
  if (!token) return { list: [], total: 0 };
  const status = tabs.value[activeTab.value].key;
  const res = await orderApi.mine({ status, page, pageSize });
  const d = res.data || {};
  return { list: d.list || [], total: d.total || 0 };
};

const loadInitial = async () => {
  firstLoading.value = true;
  orders.value = [];
  currentPage = 1;
  finished.value = false;
  try {
    const { list, total } = await fetchOrders(1);
    orders.value = list;
    if (list.length >= total || list.length < pageSize) finished.value = true;
  } catch (err) {
    if (err.response?.status === 401) {
      showToast(t('orders.loginFirst'));
      router.push('/login');
    }
  } finally {
    firstLoading.value = false;
    refreshing.value = false;
  }
};

const loadMore = async () => {
  currentPage++;
  try {
    const { list, total } = await fetchOrders(currentPage);
    orders.value.push(...list);
    if (orders.value.length >= total || list.length < pageSize) finished.value = true;
  } catch {
    finished.value = true;
  } finally {
    loadingMore.value = false;
  }
};

const onRefresh = () => {
  loadInitial();
};

const onTabChange = () => {
  loadInitial();
};

const cancelOrder = async (order) => {
  try {
    await showConfirmDialog({ title: t('orders.cancel'), message: t('orders.cancelConfirm') });
    await orderApi.cancel(order.id);
    showToast(t('orders.cancelled2'));
    loadInitial();
  } catch { /* user cancelled dialog */ }
};

onMounted(loadInitial);
</script>

<style scoped>
.orders-page {
  position: relative;
  background: var(--vino-bg);
  min-height: 100vh;
}
.orders-page :deep(.van-tabs) {
  position: relative;
  z-index: 1;
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
  border-top: 1px solid var(--vino-bg, #f7f7f7);
}
</style>
