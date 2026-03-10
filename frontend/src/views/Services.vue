<template>
  <div class="services-page">
    <van-nav-bar title="全部服务" />

    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)">
      <van-tab v-for="cat in categories" :key="cat.key" :title="cat.name">
        <div class="service-grid">
          <div
            v-for="item in cat.items"
            :key="item.id"
            class="grid-card"
            @click="$router.push(`/service/${item.id}`)"
          >
            <div class="grid-icon" :style="{ background: item.bg }">
              <van-icon :name="item.icon" size="28" color="#fff" />
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <span class="grid-price">¥{{ item.price }}起</span>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const activeTab = ref(0);

const categories = [
  {
    key: 'repair',
    name: '维修',
    items: [
      { id: 1, title: '设备维修', desc: '专业工程师', icon: 'setting-o', price: '99', bg: '#B91C1C' },
      { id: 2, title: '上门维修', desc: '快速响应', icon: 'location-o', price: '149', bg: '#DC2626' },
      { id: 3, title: '远程支持', desc: '在线指导', icon: 'phone-o', price: '29', bg: '#EF4444' },
    ],
  },
  {
    key: 'clean',
    name: '清洁',
    items: [
      { id: 4, title: '深度清洁', desc: '全方位保养', icon: 'brush-o', price: '149', bg: '#2563EB' },
      { id: 5, title: '日常清洁', desc: '基础维护', icon: 'smile-o', price: '69', bg: '#3B82F6' },
    ],
  },
  {
    key: 'inspect',
    name: '检测',
    items: [
      { id: 6, title: '全面检测', desc: '系统评估', icon: 'scan', price: '49', bg: '#059669' },
      { id: 7, title: '性能优化', desc: '提速升级', icon: 'fire-o', price: '79', bg: '#10B981' },
    ],
  },
  {
    key: 'data',
    name: '数据',
    items: [
      { id: 8, title: '数据恢复', desc: '专业找回', icon: 'replay', price: '199', bg: '#7C3AED' },
      { id: 9, title: '数据备份', desc: '安全迁移', icon: 'description', price: '59', bg: '#8B5CF6' },
    ],
  },
];
</script>

<style scoped>
.services-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.service-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px;
}

.grid-card {
  background: var(--vino-card);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.grid-card:active {
  transform: scale(0.97);
}

.grid-icon {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.grid-card h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.grid-card p {
  font-size: 12px;
  color: var(--vino-text-secondary);
  margin-bottom: 8px;
}

.grid-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--vino-primary);
}
</style>
