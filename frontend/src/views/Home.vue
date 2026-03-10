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
          <circle cx="498" cy="38" r="10" stroke="#999" stroke-width="1.5" fill="none"/>
          <text x="498" y="43" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" font-weight="bold">R</text>
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
    <div class="nav-grid">
      <div
        v-for="nav in navItems"
        :key="nav.title"
        class="nav-item"
        @click="$router.push(nav.path)"
      >
        <div class="nav-icon" :style="{ background: nav.color }">
          <van-icon :name="nav.icon" size="24" color="#fff" />
        </div>
        <span>{{ nav.title }}</span>
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
          @click="$router.push(`/service/${item.id}`)"
        >
          <div class="service-cover" :style="{ background: item.coverBg }">
            <van-icon :name="item.icon" size="40" color="#fff" />
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
            <van-icon :name="item.icon" size="32" color="#fff" />
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
import { ref, watch, nextTick } from 'vue';
import QRCode from 'qrcode';
import { showToast } from 'vant';

const searchText = ref('');
const showShare = ref(false);
const qrCanvas = ref(null);
const shareUrl = window.location.origin;

watch(showShare, async (val) => {
  if (val) {
    await nextTick();
    if (qrCanvas.value) {
      QRCode.toCanvas(qrCanvas.value, shareUrl, {
        width: 180,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
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

const banners = [
  { id: 1, title: 'Vino 品质服务', desc: '专业·高效·可信赖', bg: 'linear-gradient(135deg, #B91C1C, #7F1D1D)' },
  { id: 2, title: '新用户专享', desc: '首单立减 20 元', bg: 'linear-gradient(135deg, #1E40AF, #1E3A5F)' },
  { id: 3, title: '企业解决方案', desc: '定制化一站式服务', bg: 'linear-gradient(135deg, #065F46, #064E3B)' },
];

const navItems = [
  { title: '全部服务', icon: 'apps-o', path: '/services', color: '#B91C1C' },
  { title: '预约', icon: 'calendar-o', path: '/services', color: '#D97706' },
  { title: '维修', icon: 'setting-o', path: '/services', color: '#2563EB' },
  { title: '咨询', icon: 'chat-o', path: '/services', color: '#7C3AED' },
  { title: '安装', icon: 'logistics', path: '/services', color: '#059669' },
  { title: '保养', icon: 'shield-o', path: '/services', color: '#DC2626' },
  { title: '检测', icon: 'scan', path: '/services', color: '#EA580C' },
  { title: '更多', icon: 'more-o', path: '/services', color: '#6B7280' },
];

const hotServices = [
  { id: 1, title: '设备维修', desc: '专业工程师上门服务', price: '99', icon: 'setting-o', coverBg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
  { id: 2, title: '深度清洁', desc: '全方位清洁保养', price: '149', icon: 'brush-o', coverBg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
  { id: 3, title: '系统检测', desc: '全面检测评估', price: '49', icon: 'scan', coverBg: 'linear-gradient(135deg, #059669, #047857)' },
  { id: 4, title: '数据恢复', desc: '专业数据找回', price: '199', icon: 'replay', coverBg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
];

const recommends = [
  { id: 1, title: '会员权益', desc: '专属折扣', icon: 'vip-card-o', bg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
  { id: 2, title: '服务保障', desc: '无忧售后', icon: 'shield-o', bg: 'linear-gradient(135deg, #10B981, #059669)' },
  { id: 3, title: '积分商城', desc: '好礼兑换', icon: 'gift-o', bg: 'linear-gradient(135deg, #EC4899, #DB2777)' },
  { id: 4, title: '邀请有礼', desc: '分享得佣金', icon: 'friends-o', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)' },
];
</script>

<style scoped>
.home {
  padding-bottom: 50px;
}

.header {
  background: var(--vino-dark);
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 100;
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
  background: #222;
}

.search :deep(.van-field__control) {
  color: #fff;
}

.banner {
  height: 160px;
}

.banner-item {
  height: 160px;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.banner-content h2 {
  color: #fff;
  font-size: 22px;
  margin-bottom: 8px;
}

.banner-content p {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  padding: 20px 16px;
  background: var(--vino-card);
  margin-bottom: 10px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
}

.nav-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-item span {
  font-size: 12px;
  color: var(--vino-text);
}

.section {
  background: var(--vino-card);
  padding: 16px;
  margin-bottom: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.section-header h3 {
  font-size: 17px;
  font-weight: 600;
}

.more {
  font-size: 13px;
  color: var(--vino-text-secondary);
}

.service-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.service-list::-webkit-scrollbar {
  display: none;
}

.service-card {
  min-width: 140px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--vino-card);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.service-cover {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.service-info {
  padding: 10px;
}

.service-info h4 {
  font-size: 14px;
  margin-bottom: 4px;
}

.service-info p {
  font-size: 11px;
  color: var(--vino-text-secondary);
  margin-bottom: 6px;
}

.price {
  font-size: 15px;
  font-weight: 600;
  color: var(--vino-primary);
}

.recommend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.recommend-card {
  background: var(--vino-bg);
  border-radius: 10px;
  padding: 16px;
}

.recommend-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.recommend-card h4 {
  font-size: 14px;
  margin-bottom: 4px;
}

.recommend-card p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.footer-space {
  height: 20px;
}

.share-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  transition: background 0.2s;
}

.share-btn:active {
  background: rgba(255, 255, 255, 0.2);
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
  border-radius: 16px;
  padding: 24px 20px;
  width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.share-card-header {
  width: 160px;
  height: 50px;
  background: #000;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  padding: 8px 16px;
}

.share-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.share-qr {
  padding: 12px;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  margin-bottom: 16px;
}

.share-qr canvas {
  display: block;
}

.share-hint {
  font-size: 14px;
  color: var(--vino-text);
  font-weight: 500;
  margin-bottom: 6px;
}

.share-url {
  font-size: 11px;
  color: var(--vino-text-secondary);
  margin-bottom: 14px;
  word-break: break-all;
  text-align: center;
}

.share-copy-btn {
  width: 120px;
}

.share-close {
  margin-top: 20px;
  cursor: pointer;
}
</style>
