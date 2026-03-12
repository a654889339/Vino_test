<template>
  <div class="home">
    <!-- Hero Section: Background Image + Logo -->
    <div class="hero" :style="heroBgUrl ? { backgroundImage: `url(${heroBgUrl})` } : {}">
      <div class="hero-overlay">
        <div class="hero-header">
          <img v-if="headerLogoUrl" :src="headerLogoUrl" class="hero-logo" alt="Logo" />
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="hero-logo-svg">
            <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#fff"/>
            <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#fff"/>
            <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#fff"/>
            <circle cx="420" cy="102" r="68" stroke="#fff" stroke-width="28" fill="none"/>
            <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#fff"/>
          </svg>
          <div class="hero-actions">
            <div class="share-btn" @click="showShare = true">
              <van-icon name="share-o" size="18" color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share QR Popup -->
    <van-overlay :show="showShare" @click="showShare = false">
      <div class="share-popup" @click.stop>
        <div class="share-card">
          <div class="share-card-header">
            <img v-if="headerLogoUrl" :src="headerLogoUrl" style="height:32px;object-fit:contain" />
            <span v-else style="color:#fff;font-weight:700;font-size:18px;letter-spacing:2px">VINO</span>
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

const headerLogoUrl = computed(() => {
  const logo = allItems.value.find(i => i.section === 'headerLogo' && i.status === 'active');
  return logo?.imageUrl || '';
});

const heroBgUrl = computed(() => {
  const bg = allItems.value.find(i => i.section === 'homeBg' && i.status === 'active');
  return bg?.imageUrl || '';
});

const navItems = computed(() =>
  allItems.value.filter(i => i.section === 'nav' && i.status === 'active').map(i => ({ title: i.title, icon: i.icon, path: i.path || '/services', color: i.color }))
);
const hotServices = computed(() =>
  allItems.value.filter(i => i.section === 'hotService' && i.status === 'active').map(i => ({ id: i.id, title: i.title, desc: i.desc, price: i.price, icon: i.icon, coverBg: i.color, path: i.path || '/services' }))
);
const recommends = computed(() =>
  allItems.value.filter(i => i.section === 'recommend' && i.status === 'active').map(i => ({ id: i.id, title: i.title, desc: i.desc, icon: i.icon, bg: i.color }))
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

/* ===== Hero Section ===== */
.hero {
  position: relative;
  height: 55vw;
  max-height: 320px;
  min-height: 200px;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  background-size: cover;
  background-position: center;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.02) 50%, rgba(255,255,255,0.1) 100%);
  display: flex;
  flex-direction: column;
}

.hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  padding-top: max(14px, env(safe-area-inset-top));
}

.hero-logo {
  height: 30px;
  width: auto;
  max-width: 100px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.hero-logo-svg {
  width: 64px;
  height: 26px;
}

.hero-actions {
  display: flex;
  gap: 8px;
}

/* ===== Quick Nav ===== */
.nav-section {
  padding: 20px !important;
  margin-top: -20px;
  position: relative;
  z-index: 2;
  border-radius: 16px 16px 0 0;
  background: #fff;
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
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.25s var(--vino-transition);
}

.share-btn:active {
  background: rgba(255, 255, 255, 0.3);
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
