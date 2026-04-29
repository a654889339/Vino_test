<template>
  <div v-if="maintenanceMode" class="maintenance-overlay" role="dialog" aria-modal="true">
    <div class="maintenance-card">
      <van-loading size="30" style="margin-bottom:12px" />
      <div class="maintenance-title">{{ maintenanceTitle }}</div>
      <div class="maintenance-desc">{{ maintenanceDesc }}</div>
      <div class="maintenance-meta" v-if="maintenanceUpdatedAt">{{ maintenanceUpdatedAt }}</div>
    </div>
  </div>
  <SplashScreen v-if="showSplash" />
  <router-view v-slot="{ Component }">
    <keep-alive include="Home,Products,Services,Mine,Cart">
      <component :is="Component" />
    </keep-alive>
  </router-view>
  <div v-if="showTabbar && tabbarItems.length" class="app-tabbar-shell" :class="{ 'has-skin': !!tabbarSkinLayer }">
    <div v-if="tabbarSkinLayer" class="section-skin-layer app-tabbar-skin" :style="tabbarSkinLayer" aria-hidden="true" />
    <van-tabbar route active-color="var(--vino-primary)" class="app-tabbar-bar">
      <van-tabbar-item v-for="(item, i) in tabbarItems" :key="item.path || i" :to="item.path" :icon="item.icon">{{ pick(item, 'title') }}</van-tabbar-item>
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
import { loadI18nTexts, t, pick } from '@/utils/i18n';
import request from '@/api/request';

const route = useRoute();

const DEFAULT_TABBAR = [
  { title: '首页', icon: 'wap-home-o', path: '/', i18nKey: 'tabbar.home' },
  { title: '产品', icon: 'label-o', path: '/products', i18nKey: 'tabbar.products' },
  { title: '服务', icon: 'apps-o', path: '/services', i18nKey: 'tabbar.services' },
  { title: '我的', icon: 'contact-o', path: '/mine', i18nKey: 'tabbar.mine' },
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
        titleEn: (s.titleEn && String(s.titleEn).trim()) || '',
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
  await Promise.all([loadI18nTexts(), loadTabbarConfig(), loadCurrencyConfig(), loadAppStatus()]);
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

// ---- Feature flags / Maintenance mode ----
const appStatus = ref(null);
provide('appStatus', appStatus);

const maintenanceMode = computed(() => !!appStatus.value?.maintenanceMode);
const maintenanceTitle = computed(() => t('系统维护中', 'Maintenance'));
const maintenanceDesc = computed(() => t('当前系统正在维护，部分功能暂不可用，请稍后再试。', 'The system is under maintenance. Please try again later.'));
const maintenanceUpdatedAt = computed(() => {
  const ts = appStatus.value?.updatedAtUnixMs;
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return t('更新时间：', 'Updated at: ') + d.toLocaleString();
  } catch {
    return '';
  }
});

async function loadAppStatus() {
  try {
    const res = await request.get('/app/status');
    appStatus.value = res.data || null;
  } catch {
    // ignore; keep null
  }
}
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

/* 未配置底栏皮肤时，保持默认底栏背景，避免出现“按钮背景透明” */
.app-tabbar-shell:not(.has-skin) :deep(.van-tabbar) {
  background: var(--van-tabbar-background, #fff) !important;
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

.app-tabbar-shell :deep(.van-tabbar) {
  --van-tabbar-height: 60px;
  height: 60px !important;
  padding-bottom: env(safe-area-inset-bottom, 0);
  box-sizing: content-box;
}
.app-tabbar-shell :deep(.van-tabbar-item__icon) {
  font-size: 26px !important;
  line-height: 1;
  margin-bottom: 4px;
}
.app-tabbar-shell :deep(.van-tabbar-item__icon .van-icon) {
  font-size: inherit !important;
}
.app-tabbar-shell :deep(.van-tabbar-item__text) {
  font-size: 12px !important;
  line-height: 1.2;
}

.maintenance-overlay {
  position: fixed;
  z-index: 9999;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.maintenance-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 14px;
  padding: 22px 18px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.maintenance-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
}

.maintenance-desc {
  font-size: 13px;
  line-height: 1.6;
  color: #6b7280;
}

.maintenance-meta {
  margin-top: 10px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
