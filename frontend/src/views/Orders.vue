<template>
  <div class="orders-page">
    <van-nav-bar title="我的订单" />

    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)">
      <van-tab title="全部">
        <van-empty v-if="!orders.length" description="暂无订单" />
        <div v-else class="order-list">
          <div v-for="order in orders" :key="order.id" class="order-card">
            <div class="order-header">
              <span class="order-no">订单号: {{ order.no }}</span>
              <van-tag :type="order.statusType">{{ order.statusText }}</van-tag>
            </div>
            <div class="order-body">
              <van-icon :name="order.icon" size="36" :color="order.color" />
              <div class="order-info">
                <h4>{{ order.title }}</h4>
                <p>{{ order.time }}</p>
              </div>
              <span class="order-price">¥{{ order.price }}</span>
            </div>
          </div>
        </div>
      </van-tab>
      <van-tab title="待支付" />
      <van-tab title="进行中" />
      <van-tab title="已完成" />
    </van-tabs>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const activeTab = ref(0);

const orders = ref([
  {
    id: 1,
    no: 'VN202403001',
    title: '设备维修',
    time: '2024-03-10 14:30',
    price: '99',
    icon: 'setting-o',
    color: '#B91C1C',
    statusText: '已完成',
    statusType: 'success',
  },
  {
    id: 2,
    no: 'VN202403002',
    title: '深度清洁',
    time: '2024-03-08 10:00',
    price: '149',
    icon: 'brush-o',
    color: '#2563EB',
    statusText: '进行中',
    statusType: 'primary',
  },
]);
</script>

<style scoped>
.orders-page {
  background: var(--vino-bg);
  min-height: 100vh;
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

.order-info {
  flex: 1;
}

.order-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.order-info p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.order-price {
  font-size: 16px;
  font-weight: 600;
  color: var(--vino-primary);
}
</style>
