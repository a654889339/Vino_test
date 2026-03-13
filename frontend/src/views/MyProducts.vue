<template>
  <div class="my-products-page">
    <van-nav-bar title="我的商品" left-arrow @click-left="$router.back()" />
    <van-empty v-if="!loading && list.length === 0" description="暂无绑定商品" />
    <div v-else class="list">
      <div v-for="(item, i) in list" :key="item.productKey + i" class="item-card">
        <div class="item-row">
          <span class="label">种类</span>
          <span class="value">{{ item.categoryName || '-' }}</span>
        </div>
        <div class="item-row">
          <span class="label">名称</span>
          <span class="value">{{ item.productName || item.productKey }}</span>
        </div>
        <div class="item-row">
          <span class="label">序列号</span>
          <span class="value sn">{{ item.productKey }}</span>
        </div>
        <div class="item-row">
          <span class="label">绑定时间</span>
          <span class="value">{{ formatTime(item.boundAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { authApi } from '@/api';

const loading = ref(true);
const list = ref([]);

function formatTime(t) {
  if (!t) return '-';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(async () => {
  try {
    const res = await authApi.myProducts();
    list.value = res.data || [];
  } catch {
    list.value = [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.my-products-page {
  min-height: 100vh;
  background: var(--vino-bg, #f7f7f7);
}
.list {
  padding: 12px 16px 24px;
}
.item-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}
.item-row .label {
  color: #999;
  min-width: 72px;
}
.item-row .value {
  color: #333;
  flex: 1;
  text-align: right;
  word-break: break-all;
}
.item-row .value.sn {
  font-family: monospace;
  font-size: 13px;
}
</style>
