<template>
  <SplashScreen v-if="showSplash" />
  <router-view />
  <van-tabbar v-if="showTabbar" v-model="activeTab" route active-color="var(--vino-primary)">
    <van-tabbar-item to="/" icon="wap-home-o">首页</van-tabbar-item>
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
const showChatWidget = computed(() => {
  return !route.path.startsWith('/login') && !route.path.startsWith('/register');
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
:deep(.van-tabbar) {
  max-width: 750px;
  margin: 0 auto;
}
</style>
