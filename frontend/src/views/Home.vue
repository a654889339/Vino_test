<template>
  <div class="home">
    <!-- Header -->
    <div class="header">
      <div class="header-inner">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="logo">
          <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
          <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
          <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
          <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
          <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
          <circle cx="498" cy="38" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" fill="none"/>
          <text x="498" y="43" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.3)" text-anchor="middle" font-weight="bold">R</text>
        </svg>
        <van-search
          v-model="searchText"
          shape="round"
          placeholder="搜索服务"
          class="search"
        />
        <div class="share-btn" @click="showShare = true">
          <van-icon name="share-o" size="20" color="#fff" />
        </div>
      </div>
    </div>

    <!-- Share QR Popup -->
    <van-overlay :show="showShare" @click="showShare = false">
      <div class="share-popup" @click.stop>
        <div class="share-card">
          <div class="share-card-header">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="share-logo">
              <rect width="520" height="200" fill="#000"/>
              <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
              <path d="M38 35 L55 35 L55 60 L45 35 Z" fill="#000" opacity="0.2"/>
              <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
              <path d="M172 35 L180 35 L180 170 L172 170 Z" fill="#000" opacity="0.15"/>
              <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
              <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
              <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
              <circle cx="498" cy="38" r="10" stroke="#666" stroke-width="1.5" fill="none"/>
              <text x="498" y="43" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" font-weight="bold">R</text>
            </svg>
          </div>
          <div class="share-qr">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <p class="share-hint">扫描二维码，打开 Vino 服务站</p>
          <div class="share-url">{{ shareUrl }}</div>
          <van-button
            size="small"
            round
            plain
            type="primary"
            color="#B91C1C"
            class="share-copy-btn"
            @click="copyUrl"
          >
            复制链接
          </van-button>
        </div>
        <van-icon name="close" size="28" color="rgba(255,255,255,0.6)" class="share-close" @click="showShare = false" />
      </div>
    </van-overlay>

    <!-- Banner Swiper -->
    <van-swipe :autoplay="4000" indicator-color="#B91C1C" class="banner">
      <van-swipe-item v-for="banner in banners" :key="banner.id">
        <div class="banner-item" :style="{ background: banner.bg }">
          <div class="banner-content">
            <h2>{{ banner.title }}</h2>
            <p>{{ banner.desc }}</p>
          </div>
        </div>
      </van-swipe-item>
    </van-swipe>

    <!-- Quick Nav -->
    <div class="section nav-section">
      <div class="nav-grid">
        <div
          v-for="nav in navItems"
          :key="nav.title"
          class="nav-item"
          @click="$router.push(nav.path)"
        >
          <div class="nav-icon" :style="{ background: nav.color }">
            <van-icon :name="nav.icon" size="22" color="#fff" />
          </div>
          <span>{{ nav.title }}</span>
        </div>
      </div>
    </div>

    <!-- Hot Services -->
    <div class="section">
      <div class="section-header">
        <h3>热门服务</h3>
        <span class="more" @click="$router.push('/services')">查看全部 ›</span>
      </div>
      <div class="service-list">
        <div
          v-for="item in hotServices"
          :key="item.id"
          class="service-card"
          @click="$router.push(item.path)"
        >
          <div class="service-cover" :style="{ background: item.coverBg }">
            <van-icon :name="item.icon" size="36" color="#fff" />
          </div>
          <div class="service-info">
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <span class="price">¥{{ item.price }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommend -->
    <div class="section">
      <div class="section-header">
        <h3>为你推荐</h3>
      </div>
      <div class="recommend-grid">
        <div
          v-for="item in recommends"
          :key="item.id"
          class="recommend-card"
        >
          <div class="recommend-icon" :style="{ background: item.bg }">
            <van-icon :name="item.icon" size="28" color="#fff" />
          </div>
          <h4>{{ item.title }}</h4>
          <p>{{ item.desc }}</p>
        </div>
      </div>
    </div>

    <div class="footer-space"></div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import QRCode from 'qrcode';
import { showToast } from 'vant';
import { homeConfigApi } from '@/api';

const searchText = ref('');
const showShare = ref(false);
const qrCanvas = ref(null);
const shareUrl = window.location.origin;
const allItems = ref([]);

onMounted(async () => {
  try {
    const res = await homeConfigApi.list();
    allItems.value = res.data || [];
  } catch { /* use empty */ }
});

const banners = computed(() =>
  allItems.value.filter(i => i.section === 'banner').map(i => ({ id: i.id, title: i.title, desc: i.desc, bg: i.color }))
);
const navItems = computed(() =>
  allItems.value.filter(i => i.section === 'nav').map(i => ({ title: i.title, icon: i.icon, path: i.path || '/services', color: i.color }))
);
const hotServices = computed(() =>
  allItems.value.filter(i => i.section === 'hotService').map(i => ({ id: i.id, title: i.title, desc: i.desc, price: i.price, icon: i.icon, coverBg: i.color, path: i.path || '/services' }))
);
const recommends = computed(() =>
  allItems.value.filter(i => i.section === 'recommend').map(i => ({ id: i.id, title: i.title, desc: i.desc, icon: i.icon, bg: i.color }))
);

watch(showShare, async (val) => {
  if (val) {
    await nextTick();
    if (qrCanvas.value) {
      QRCode.toCanvas(qrCanvas.value, shareUrl, {
        width: 180,
        margin: 2,
        color: { dark: '#1d1d1f', light: '#ffffff' },
      });
    }
  }
});

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('链接已复制');
  } catch {
    showToast('复制失败，请手动复制');
  }
};
</script>

<style scoped>
.home {
  padding-bottom: 50px;
}

/* ===== Header ===== */
.header {
  background: var(--vino-dark);
  padding: 14px 20px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: saturate(180%) blur(20px);
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 60px;
  height: 24px;
  object-fit: contain;
}

.search {
  flex: 1;
  padding: 0;
}

.search :deep(.van-search__content) {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
}

.search :deep(.van-field__control) {
  color: rgba(255, 255, 255, 0.9);
}

.search :deep(.van-field__control::placeholder) {
  color: rgba(255, 255, 255, 0.35);
}

/* ===== Banner ===== */
.banner {
  height: 180px;
}

.banner-item {
  height: 180px;
  display: flex;
  align-items: center;
  padding: 0 28px;
}

.banner-content h2 {
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 8px;
  line-height: 1.15;
}

.banner-content p {
  color: rgba(255, 255, 255, 0.75);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.5;
}

/* ===== Quick Nav ===== */
.nav-section {
  padding: 20px !important;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.nav-item:active {
  transform: scale(0.92);
}

.nav-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--vino-transition);
}

.nav-item span {
  font-size: 12px;
  color: var(--vino-text);
  font-weight: 500;
}

/* ===== Section ===== */
.section {
  background: var(--vino-card);
  padding: 20px;
  margin-bottom: 8px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
}

.section:nth-child(3) { animation-delay: 0.05s; }
.section:nth-child(4) { animation-delay: 0.1s; }
.section:nth-child(5) { animation-delay: 0.15s; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--vino-dark);
}

.more {
  font-size: 14px;
  color: var(--vino-primary);
  font-weight: 500;
  cursor: pointer;
}

/* ===== Hot Services ===== */
.service-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.service-list::-webkit-scrollbar {
  display: none;
}

.service-card {
  min-width: 150px;
  flex-shrink: 0;
  border-radius: var(--vino-radius);
  overflow: hidden;
  background: var(--vino-card);
  box-shadow: var(--vino-shadow);
  cursor: pointer;
  transition: transform 0.3s var(--vino-transition), box-shadow 0.3s var(--vino-transition);
}

.service-card:active {
  transform: scale(0.96);
}

.service-cover {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-info {
  padding: 12px 14px 14px;
}

.service-info h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vino-dark);
}

.service-info p {
  font-size: 12px;
  color: var(--vino-text-secondary);
  margin-bottom: 8px;
}

.price {
  font-size: 17px;
  font-weight: 700;
  color: var(--vino-primary);
  letter-spacing: -0.02em;
}

/* ===== Recommend ===== */
.recommend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.recommend-card {
  background: var(--vino-bg);
  border-radius: var(--vino-radius);
  padding: 20px 16px;
  transition: transform 0.25s var(--vino-transition);
  cursor: pointer;
}

.recommend-card:active {
  transform: scale(0.97);
}

.recommend-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.recommend-card h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vino-dark);
}

.recommend-card p {
  font-size: 13px;
  color: var(--vino-text-secondary);
  line-height: 1.5;
}

.footer-space {
  height: 24px;
}

/* ===== Share ===== */
.share-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.25s var(--vino-transition);
}

.share-btn:active {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(0.92);
}

.share-popup {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
}

.share-card {
  background: #fff;
  border-radius: 20px;
  padding: 28px 24px;
  width: 290px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}

.share-card-header {
  width: 160px;
  height: 50px;
  background: #000;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  padding: 8px 16px;
}

.share-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.share-qr {
  padding: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  margin-bottom: 18px;
}

.share-qr canvas {
  display: block;
}

.share-hint {
  font-size: 15px;
  color: var(--vino-dark);
  font-weight: 600;
  margin-bottom: 6px;
}

.share-url {
  font-size: 12px;
  color: var(--vino-text-secondary);
  margin-bottom: 16px;
  word-break: break-all;
  text-align: center;
}

.share-copy-btn {
  width: 130px;
}

.share-close {
  margin-top: 24px;
  cursor: pointer;
}
</style>
