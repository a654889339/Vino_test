<template>
  <div class="home">
    <!-- Header -->
    <div class="header">
      <div class="header-inner">
        <img src="https://itsyourturnmy-1256887166.cos.ap-singapore.myqcloud.com/vino/logo.svg" alt="Vino" class="logo" />
        <van-search
          v-model="searchText"
          shape="round"
          placeholder="搜索服务"
          class="search"
        />
      </div>
    </div>

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
import { ref } from 'vue';

const searchText = ref('');

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
</style>
