<template>
  <SplashScreen v-if="showSplash" />
  <router-view />
  <div v-if="showTabbar && tabbarItems.length" class="app-tabbar-shell">
    <div v-if="tabbarSkinLayer" class="section-skin-layer app-tabbar-skin" :style="tabbarSkinLayer" aria-hidden="true" />
    <van-tabbar route active-color="var(--vino-primary)" class="app-tabbar-bar">
      <van-tabbar-item v-for="(item, i) in tabbarItems" :key="item.path || i" :to="item.path" :icon="item.icon">{{ item.title }}</van-tabbar-item>
    </van-tabbar>
  </div>
  <ChatWidget ref="chatWidgetRef" :hide-fab="hideChatFab" />
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import SplashScreen from '@/components/SplashScreen.vue';
import ChatWidget from '@/components/ChatWidget.vue';
import { homeConfigApi } from '@/api';
import { initFromHomeConfigList } from '@/utils/currency';
import { buildSectionSkinLayerStyle } from '@/utils/sectionSkin';

const route = useRoute();

const DEFAULT_TABBAR = [
  { title: '首页', icon: 'wap-home-o', path: '/' },
  { title: '产品', icon: 'label-o', path: '/products' },
  { title: '服务', icon: 'apps-o', path: '/services' },
  { title: '订单', icon: 'bill-o', path: '/orders' },
  { title: '我的', icon: 'contact-o', path: '/mine' },
];

const tabbarItems = ref([...DEFAULT_TABBAR]);
/** 与底栏皮肤共用：栏目外观 tabbar */
const homeConfigListForSkin = ref([]);
const tabbarSkinLayer = computed(() => buildSectionSkinLayerStyle(homeConfigListForSkin.value, 'tabbar'));

function mergeTabbarWithDefaults(serverList) {
  const active = (serverList || []).filter((i) => i.status === 'active');
  const byPath = {};
  active.forEach((i) => {
    const p = (i.path && String(i.path).trim()) || '/';
    byPath[p] = i;
  });
  return DEFAULT_TABBAR.map((def) => {
    const s = byPath[def.path];
    if (s) {
      return {
        title: (s.title && String(s.title).trim()) || def.title,
        icon: (s.icon && String(s.icon).trim()) || def.icon,
        path: def.path,
      };
    }
    return { ...def };
  });
}

async function loadTabbarConfig() {
  try {
    const [tabRes, listRes] = await Promise.all([
      homeConfigApi.tabbar(),
      homeConfigApi.list().catch(() => ({ data: [] })),
    ]);
    const list = tabRes.data || [];
    tabbarItems.value = mergeTabbarWithDefaults(list);
    homeConfigListForSkin.value = listRes.data || [];
  } catch {
    tabbarItems.value = [...DEFAULT_TABBAR];
    homeConfigListForSkin.value = [];
  }
}

async function loadCurrencyConfig() {
  try {
    const res = await homeConfigApi.list({ params: { section: 'currency' } });
    initFromHomeConfigList(res.data || []);
  } catch {
    initFromHomeConfigList([]);
  }
}

onMounted(async () => {
  await Promise.all([loadTabbarConfig(), loadCurrencyConfig()]);
});

const hiddenTabRoutes = ['/login', '/register', '/service/', '/address', '/guide/'];
const showTabbar = computed(() => {
  return !hiddenTabRoutes.some((r) => route.path.startsWith(r));
});
// 首页、产品页、我的页面不显示聊天悬浮按钮（与小程序一致）；组件始终挂载以便「意见反馈」可打开聊天
const hideChatFab = computed(() => {
  const p = route.path;
  if (p === '/' || p === '/products' || p === '/mine') return true;
  if (p.startsWith('/login') || p.startsWith('/register')) return true;
  return false;
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
.app-tabbar-shell {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  margin: 0 auto;
  z-index: 3000;
  pointer-events: none;
}
.app-tabbar-shell .app-tabbar-bar {
  pointer-events: auto;
}
/* 底栏改为相对定位以便与皮肤层同容器叠放；背景透明以露出栏目外观图 */
:deep(.app-tabbar-bar) {
  position: relative !important;
  max-width: 750px;
  margin: 0 auto;
  background: transparent !important;
  z-index: 1;
}
.app-tabbar-shell .section-skin-layer {
  border-radius: 0;
}
:deep(.van-tabbar-item) {
  touch-action: manipulation;
  cursor: pointer;
}

/* 底栏高度与图标约 +50%（相对默认约 50px / 22px 档） */
.app-tabbar-shell :deep(.van-tabbar) {
  --van-tabbar-height: 75px;
  height: 75px !important;
  padding-bottom: env(safe-area-inset-bottom, 0);
  box-sizing: content-box;
}
.app-tabbar-shell :deep(.van-tabbar-item__icon) {
  font-size: 33px !important;
  line-height: 1;
  margin-bottom: 6px;
}
.app-tabbar-shell :deep(.van-tabbar-item__icon .van-icon) {
  font-size: inherit !important;
}
.app-tabbar-shell :deep(.van-tabbar-item__text) {
  font-size: 15px !important;
  line-height: 1.2;
}
</style>
