<template>
  <div class="guide-detail-page">
    <van-nav-bar :title="displayGuideTitle" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align:center;padding:80px 0" />

    <template v-else-if="guide.id">
      <!-- Hero + Media -->
      <div class="hero-block">
        <div class="hero-section">
          <div v-if="guide.showcaseVideo" class="hero-video-wrap" @click="playVideo(fullUrl(guide.showcaseVideo))">
            <LodImg v-if="heroCoverSrc" :src="heroCoverSrc" :thumb="heroCoverThumbSrc" class="hero-img" />
            <div v-else class="hero-placeholder" :style="{ background: guide.gradient }">
              <LodImg v-if="heroIconSrc" :src="heroIconSrc" style="width:64px;height:64px;object-fit:contain" />
              <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            </div>
            <div class="hero-play-btn"><van-icon name="play-circle" size="48" color="#fff" /></div>
          </div>
          <div v-else-if="heroCoverSrc" class="hero-img-wrap" @click="previewImage(heroCoverSrc)">
            <LodImg :src="heroCoverSrc" :thumb="heroCoverThumbSrc" class="hero-img" />
          </div>
          <div v-else class="hero-gradient" :style="{ background: guide.gradient }">
            <LodImg v-if="heroIconSrc" :src="heroIconSrc" style="width:64px;height:64px;object-fit:contain" />
            <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            <h2>{{ displayGuideName }}</h2>
          </div>
          <div v-if="model3DEnabled" class="hero-3d-btn" @click="open3DViewer">
            <van-icon name="cube-o" size="16" color="#fff" />
            <span>{{ t('guideDetail.preview3D') }}</span>
          </div>
        </div>
        <div v-if="mediaItems.length" class="hero-media">
          <h3 class="hero-media-title">{{ mediaItems[0]?.title || displayGuideName }}</h3>
          <div class="media-scroll">
            <div v-for="(m, i) in mediaItems" :key="i" class="media-card" @click="openMedia(m)">
              <div class="media-thumb">
                <img v-if="getThumbUrl(m)" :src="getThumbUrl(m)" />
                <div v-else class="media-thumb-placeholder"><van-icon :name="isVideo(m) ? 'video-o' : 'photo-o'" size="28" color="#999" /></div>
                <div v-if="isVideo(m)" class="media-play"><van-icon name="play-circle-o" size="24" color="#fff" /></div>
                <div class="media-label-overlay">{{ m.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Price Info -->
      <div v-if="shouldShowPrice(guide.listPrice)" class="price-info-card">
        <div class="price-info-row">
          <div class="price-info-name">{{ displayGuideName }}</div>
          <div class="price-info-price">
            <span class="price-now">{{ formatPriceDisplay(guide.listPrice, guide.currency) }}</span>
            <span
              v-if="shouldShowPrice(guide.originPrice) && Number(guide.originPrice) > Number(guide.listPrice || 0)"
              class="price-origin"
            >
              {{ formatPriceDisplay(guide.originPrice, guide.currency) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Help Links -->
      <div v-if="helpItems.length || sections.length" class="section-card">
        <h3 class="section-title">{{ t('guideDetail.helpSection') }}</h3>
        <van-cell-group inset :border="false">
          <van-cell v-if="helpItems.length" :title="t('guideDetail.manual')" icon="description" is-link @click="$router.push(`/guide/${guide.id}/manual`)" />
          <van-cell v-if="sections.length" :title="t('guideDetail.maintenance')" icon="info-o" is-link @click="$router.push(`/guide/${guide.id}/maintenance`)" />
        </van-cell-group>
      </div>

      <!-- Service Entry -->
      <div class="section-card">
        <h3 class="section-title">{{ t('guideDetail.serviceSection') }}</h3>
        <div class="service-entry-grid">
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#EDE9FE"><van-icon name="service-o" size="22" color="#7C3AED" /></div>
            <span>{{ t('guideDetail.selfService') }}</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#DBEAFE"><van-icon name="location-o" size="22" color="#2563EB" /></div>
            <span>{{ t('guideDetail.stores') }}</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#D1FAE5"><van-icon name="shield-o" size="22" color="#059669" /></div>
            <span>{{ t('guideDetail.policy') }}</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#FEF3C7"><van-icon name="balance-list-o" size="22" color="#D97706" /></div>
            <span>{{ t('guideDetail.repairQuote') }}</span>
          </div>
        </div>
      </div>

      <div style="height:24px"></div>
    </template>

    <!-- 3D Preview Overlay -->
    <div v-if="show3DViewer" class="viewer3d-backdrop" @click.self="close3DViewer()">
      <div class="viewer3d-overlay">
        <ProductModelViewer
          :model-url="model3DModelURL"
          :decal-url="model3DDecalURL"
          :skybox-url="model3DSkyboxURL"
          :bg-color="model3DBGColor"
        />
        <div class="viewer3d-close" @click="close3DViewer()"><van-icon name="cross" size="24" color="#fff" /></div>
        <div class="viewer3d-tip">{{ t('guideDetail.preview3DTip') }}</div>
      </div>
    </div>

    <!-- Video Player Overlay -->
    <div v-if="playShowcase" class="video-backdrop" @click.self="closeVideo()">
      <div class="video-overlay">
        <video v-if="currentVideoUrl" :src="currentVideoUrl" controls autoplay playsinline class="overlay-video" />
        <div class="video-close" @click="closeVideo()"><van-icon name="cross" size="24" color="#fff" /></div>
      </div>
    </div>
    <!-- 固定底部操作栏 -->
    <div class="guide-footer-fixed">
      <div class="footer-actions">
        <div v-if="shouldShowPrice(guide.listPrice)" class="footer-price">
          <span class="footer-price-now">{{ formatPriceDisplay(guide.listPrice, guide.currency) }}</span>
        </div>
        <div class="footer-btns">
          <van-button
            v-if="shouldShowPrice(guide.listPrice)"
            type="warning"
            round
            class="btn-cart"
            @click="addToCart"
          >
            <van-icon name="cart-o" size="16" />
            <span>{{ t('加入购物车', 'Add to Cart') }}</span>
          </van-button>
          <van-button type="primary" color="#B91C1C" round class="btn-home" @click="goHome">
            {{ t('guideDetail.backHome') }}
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showImagePreview, showToast } from 'vant';
import { guideApi, cartApi } from '@/api';
import { t, pick, isEn } from '@/utils/i18n';
import { formatPriceDisplay, shouldShowPrice } from '@/utils/currency';
import LodImg from '@/components/LodImg.vue';
import { resolveMediaUrl, guideProductMediaUrl } from '@/utils/cosMedia.js';

const ProductModelViewer = defineAsyncComponent(() =>
  import('@/components/ProductModelViewer.vue')
);

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const guide = ref({});
const playShowcase = ref(false);
const currentVideoUrl = ref('');
const show3DViewer = ref(false);
const cartLines = ref([]);

const mediaOpt = { apiBase: import.meta.env.VITE_API_BASE || '' };
const fullUrl = (url) => resolveMediaUrl(url, mediaOpt);

const guideNumericId = computed(() => {
  const n = Number(guide.value && guide.value.id);
  return Number.isFinite(n) && n > 0 ? n : 0;
});
const productLang = computed(() => (isEn.value ? 'en' : 'zh'));
const heroCoverSrc = computed(() => {
  const id = guideNumericId.value;
  if (!id) return '';
  return guideProductMediaUrl(id, 'cover', { lang: productLang.value, apiBase: mediaOpt.apiBase });
});
const heroCoverThumbSrc = computed(() => {
  const id = guideNumericId.value;
  if (!id) return '';
  return guideProductMediaUrl(id, 'cover_thumb', { lang: productLang.value, apiBase: mediaOpt.apiBase });
});
const heroIconSrc = computed(() => {
  const id = guideNumericId.value;
  if (!id) return '';
  return guideProductMediaUrl(id, 'icon', { lang: productLang.value, apiBase: mediaOpt.apiBase });
});

const model3DEnabled = computed(() => !!(guide.value && guide.value.model3dEnabled && guideNumericId.value));
// 3D 资源走后端 COS 代理（同源），避免直接请求腾讯云 COS 触发 CORS（Three.js 贴图/GLB 都需要 crossOrigin）。
const model3DModelURL = computed(() =>
  guideNumericId.value ? guideProductMediaUrl(guideNumericId.value, 'model3d', { apiBase: mediaOpt.apiBase }) : ''
);
const model3DDecalURL = computed(() =>
  guideNumericId.value ? guideProductMediaUrl(guideNumericId.value, 'decal', { apiBase: mediaOpt.apiBase }) : ''
);
const model3DSkyboxURL = computed(() =>
  guideNumericId.value ? guideProductMediaUrl(guideNumericId.value, 'skybox', { apiBase: mediaOpt.apiBase }) : ''
);
const model3DBGColor = computed(() => {
  const v = (guide.value && guide.value.model3dSkyboxBgColor) ? String(guide.value.model3dSkyboxBgColor).trim() : '';
  return v || '#1a1a2e';
});

const open3DViewer = () => { show3DViewer.value = true; };
const close3DViewer = () => { show3DViewer.value = false; };

// 按当前语言显示产品名 / 顶部标题，英文缺 nameEn 时回退到中文 name。
const displayGuideName = computed(() => pick(guide.value, 'name') || guide.value.name || '');
const displayGuideTitle = computed(() => {
  return pick(guide.value, 'subtitle')
    || pick(guide.value, 'name')
    || guide.value.name
    || t('guideDetail.title');
});

const sections = computed(() => {
  const s = guide.value.sections;
  return Array.isArray(s) ? s : [];
});
const mediaItems = computed(() => {
  const m = guide.value.mediaItems;
  return Array.isArray(m) ? m : [];
});
const helpItems = computed(() => {
  const h = guide.value.helpItems;
  return Array.isArray(h) ? h : [];
});

const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i;
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;

const isVideoUrl = (url) => url && VIDEO_EXTS.test(url);
const isImageUrl = (url) => url && IMAGE_EXTS.test(url);

const isVideo = (m) => {
  if (m.url && isVideoUrl(m.url)) return true;
  if (m.thumb && isVideoUrl(m.thumb)) return true;
  return m.type === 'video' && !isImageUrl(m.url || m.thumb || '');
};

const getMediaUrl = (m) => {
  if (m.url) return fullUrl(m.url);
  if (m.thumb) return fullUrl(m.thumb);
  return '';
};

const getThumbUrl = (m) => {
  if (m.thumb && isImageUrl(m.thumb)) return fullUrl(m.thumb);
  if (m.url && isImageUrl(m.url)) return fullUrl(m.url);
  if (m.thumb && !isVideoUrl(m.thumb)) return fullUrl(m.thumb);
  return '';
};

const playVideo = (url) => {
  currentVideoUrl.value = url;
  playShowcase.value = true;
};

const closeVideo = () => {
  playShowcase.value = false;
  currentVideoUrl.value = '';
};

const previewImage = (url) => {
  showImagePreview({ images: [url], closeable: true });
};

const goHome = () => {
  router.replace('/');
};

async function loadCart() {
  const token = localStorage.getItem('vino_token');
  if (!token) { cartLines.value = []; return; }
  try {
    const res = await cartApi.get();
    cartLines.value = res.data?.items || [];
  } catch { cartLines.value = []; }
}

async function addToCart() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  const g = guide.value;
  if (!g || !g.id) return;
  if (!shouldShowPrice(g.listPrice)) {
    showToast('该商品暂未配置价格');
    return;
  }
  const gid = Number(g.id);
  const items = (cartLines.value || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
  const idx = items.findIndex((x) => Number(x.guideId) === gid);
  if (idx >= 0) items[idx].qty += 1;
  else items.push({ guideId: gid, qty: 1 });
  try {
    const res = await cartApi.put({ items });
    cartLines.value = res.data?.items || [];
    showToast('已加入购物车');
  } catch (e) {
    showToast(e?.message || '加入失败');
  }
}

const openMedia = (m) => {
  const url = getMediaUrl(m);
  if (!url) return;
  if (isVideo(m)) {
    playVideo(url);
  } else {
    const images = mediaItems.value
      .filter(item => !isVideo(item) && getMediaUrl(item))
      .map(item => getMediaUrl(item));
    const idx = images.indexOf(url);
    showImagePreview({ images, startPosition: idx >= 0 ? idx : 0, closeable: true });
  }
};

onMounted(async () => {
  try {
    const res = await guideApi.detail(route.params.id);
    guide.value = res.data || {};
  } catch { /* fallback empty */ }
  loading.value = false;
  loadCart();
});
</script>

<style scoped>
.guide-detail-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.guide-detail-page :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.guide-detail-page :deep(.van-nav-bar__title) {
  font-weight: 600;
  font-size: 17px;
  color: var(--vino-dark);
}

/* ===== Hero ===== */
.hero-block {
  background: #fff;
  margin-bottom: 8px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
}

.hero-section { position: relative; }

.hero-video-wrap,
.hero-img-wrap {
  position: relative;
  cursor: pointer;
}

.hero-img {
  width: 100%;
  height: 260px;
  object-fit: cover;
  display: block;
}

.hero-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 64px;
  height: 64px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--vino-transition);
}

.hero-video-wrap:active .hero-play-btn {
  transform: translate(-50%, -50%) scale(0.9);
}

.hero-gradient {
  height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #fff;
}

.hero-gradient h2 {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.hero-placeholder {
  width: 100%;
  height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== Media ===== */
.hero-media {
  padding: 20px;
}

.hero-media-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  margin-bottom: 14px;
  letter-spacing: -0.02em;
}

.media-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.media-scroll::-webkit-scrollbar { display: none; }

.media-card {
  flex-shrink: 0;
  width: 135px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.media-card:active {
  transform: scale(0.96);
}

.media-thumb {
  width: 135px;
  height: 170px;
  border-radius: var(--vino-radius-sm);
  overflow: hidden;
  position: relative;
  background: #1d1d1f;
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
}

.media-play {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-label-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 10px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Section Card ===== */
.section-card {
  background: #fff;
  margin: 8px 12px;
  border-radius: var(--vino-radius);
  padding: 20px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
  animation-delay: 0.1s;
}

.section-card + .section-card {
  animation-delay: 0.15s;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  margin-bottom: 14px;
  letter-spacing: -0.02em;
}

.section-card :deep(.van-cell) {
  padding: 14px 16px;
  border-radius: var(--vino-radius-sm);
}

.section-card :deep(.van-cell:active) {
  background: var(--vino-bg);
}

.section-card :deep(.van-cell__title) {
  font-weight: 500;
  font-size: 15px;
}

/* ===== Service Entry ===== */
.service-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.entry-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.entry-item:active {
  transform: scale(0.92);
}

.entry-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.entry-item span {
  font-size: 12px;
  color: var(--vino-text-secondary);
  font-weight: 500;
}

/* ===== Price Info Card ===== */
.price-info-card {
  background: #fff;
  margin: 8px 12px;
  border-radius: var(--vino-radius);
  padding: 16px 20px;
}
.price-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.price-info-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--vino-dark);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.price-info-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}
.price-info-price .price-now {
  color: #b91c1c;
  font-size: 20px;
  font-weight: 800;
}
.price-info-price .price-origin {
  color: #9ca3af;
  font-size: 13px;
  text-decoration: line-through;
}

/* ===== 固定底部操作栏 ===== */
.guide-footer-fixed {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 150;
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%);
  backdrop-filter: blur(8px);
}
.footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}
.footer-price {
  flex-shrink: 0;
}
.footer-price-now {
  color: #b91c1c;
  font-size: 20px;
  font-weight: 800;
  white-space: nowrap;
}
.footer-btns {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  justify-content: flex-end;
  min-width: 0;
}
.btn-cart {
  flex: 0 1 132px;
  min-width: 112px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  white-space: nowrap;
}
.btn-home {
  flex: 0 1 96px;
  min-width: 82px;
  padding: 0 12px;
  white-space: nowrap;
}
.btn-cart :deep(.van-button__content),
.btn-home :deep(.van-button__content) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

/* ===== Video Overlay ===== */
.video-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease both;
}

.video-overlay {
  position: relative;
  width: 92vw;
  max-width: 480px;
}

.overlay-video {
  width: 100%;
  border-radius: var(--vino-radius-sm);
  background: #000;
  max-height: 70vh;
  display: block;
}

.video-close {
  position: absolute;
  top: -44px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.video-close:active {
  background: rgba(255, 255, 255, 0.25);
}

.hero-3d-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(15, 15, 20, 0.72);
  color: #fff;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: transform 0.15s ease, background 0.15s ease;
  z-index: 2;
}

.hero-3d-btn:active {
  transform: scale(0.96);
  background: rgba(15, 15, 20, 0.85);
}

.viewer3d-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 220;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease both;
}

.viewer3d-overlay {
  position: relative;
  width: 96vw;
  height: 82vh;
  max-width: 900px;
  background: #0f0f14;
  border-radius: 14px;
  overflow: hidden;
}

.viewer3d-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
  transition: background 0.2s;
}

.viewer3d-close:active {
  background: rgba(255, 255, 255, 0.25);
}

.viewer3d-tip {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
</style>
