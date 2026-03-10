<template>
  <router-view />
  <van-tabbar v-if="showTabbar" v-model="activeTab" route active-color="var(--vino-primary)">
    <van-tabbar-item to="/" icon="wap-home-o">首页</van-tabbar-item>
    <van-tabbar-item to="/services" icon="apps-o">服务</van-tabbar-item>
    <van-tabbar-item to="/orders" icon="bill-o">订单</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="contact-o">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeTab = ref(0);

const hiddenTabRoutes = ['/login', '/service/'];
const showTabbar = computed(() => {
  return !hiddenTabRoutes.some((r) => route.path.startsWith(r));
});
</script>

<style scoped>
:deep(.van-tabbar) {
  max-width: 750px;
  margin: 0 auto;
}
</style>
