<template>
  <SplashScreen v-if="showSplash" />
  <router-view />
  <van-tabbar v-if="showTabbar" v-model="activeTab" route active-color="var(--vino-primary)">
    <van-tabbar-item to="/" icon="wap-home-o">首页</van-tabbar-item>
    <van-tabbar-item to="/products" icon="label-o">产品</van-tabbar-item>
    <van-tabbar-item to="/services" icon="apps-o">服务</van-tabbar-item>
    <van-tabbar-item to="/orders" icon="bill-o">订单</van-tabbar-item>
    <van-tabbar-item to="/mine" icon="contact-o">我的</van-tabbar-item>
  </van-tabbar>
  <ChatWidget v-if="showChatWidget" ref="chatWidgetRef" />
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import SplashScreen from '@/components/SplashScreen.vue';
import ChatWidget from '@/components/ChatWidget.vue';

const route = useRoute();
const activeTab = ref(0);

const hiddenTabRoutes = ['/login', '/register', '/service/', '/address', '/guide/'];
const showTabbar = computed(() => {
  return !hiddenTabRoutes.some((r) => route.path.startsWith(r));
});
// 首页、产品页、我的页面不显示聊天悬浮按钮（与小程序一致）
const showChatWidget = computed(() => {
  const p = route.path;
  if (p === '/' || p === '/products' || p === '/mine') return false;
  if (p.startsWith('/login') || p.startsWith('/register')) return false;
  return true;
});

const chatWidgetRef = ref(null);
provide('chatWidget', chatWidgetRef);

const showSplash = ref(false);

onMounted(() => {
  if (!sessionStorage.getItem('vino_splash_shown')) {
    showSplash.value = true;
    sessionStorage.setItem('vino_splash_shown', '1');
    setTimeout(() => {
      showSplash.value = false;
    }, 3500);
  }
});
</script>

<style scoped>
/* 提高 z-index，避免被页面内 fixed 或聊天 FAB 下方的触摸层遮挡，解决手机端「产品」等按钮无法点击 */
:deep(.van-tabbar) {
  max-width: 750px;
  margin: 0 auto;
  z-index: 100;
}
:deep(.van-tabbar-item) {
  touch-action: manipulation;
  cursor: pointer;
}
</style>
