<template>
  <div class="mine-page">
    <div class="profile-header">
      <div class="avatar">
        <van-icon name="user-o" size="36" color="#fff" />
      </div>
      <div class="profile-info" v-if="userStore.isLoggedIn">
        <h3>{{ userStore.userInfo?.nickname || '用户' }}</h3>
        <p>{{ userStore.userInfo?.phone || '未绑定手机' }}</p>
      </div>
      <div class="profile-info" v-else @click="$router.push('/login')">
        <h3>点击登录</h3>
        <p>登录享更多权益</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item" v-for="s in stats" :key="s.label">
        <span class="stat-num">{{ s.value }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </div>
    </div>

    <van-cell-group inset class="menu-group">
      <van-cell title="我的订单" icon="orders-o" is-link to="/orders" />
      <van-cell title="我的收藏" icon="star-o" is-link />
      <van-cell title="地址管理" icon="location-o" is-link to="/address" />
      <van-cell title="优惠券" icon="coupon-o" is-link />
    </van-cell-group>

    <van-cell-group inset class="menu-group">
      <van-cell title="帮助中心" icon="question-o" is-link />
      <van-cell title="意见反馈" icon="comment-o" is-link @click="openFeedback" />
      <van-cell title="关于Vino" icon="info-o" is-link @click="openAbout" />
    </van-cell-group>

    <div class="logout-area" v-if="userStore.isLoggedIn">
      <van-button block plain type="default" class="logout-btn" @click="handleLogout">退出登录</van-button>
    </div>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();
const chatWidgetRef = inject('chatWidget', ref(null));

const openFeedback = () => {
  if (chatWidgetRef.value) {
    chatWidgetRef.value.openWithAutoMessage('');
  }
};

const openAbout = () => {
  window.open('https://www.vinotech.cn/', '_blank');
};

const stats = [
  { label: '待支付', value: 0 },
  { label: '进行中', value: 0 },
  { label: '待评价', value: 0 },
  { label: '售后', value: 0 },
];

onMounted(async () => {
  if (userStore.isLoggedIn && !userStore.userInfo) {
    try {
      await userStore.fetchProfile();
    } catch {
      userStore.logout();
    }
  }
});

const handleLogout = () => {
  userStore.logout();
  router.push('/');
};
</script>

<style scoped>
.mine-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.profile-header {
  background: linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%);
  padding: 48px 24px 36px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-info h3 {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 5px;
  letter-spacing: -0.02em;
}

.profile-info p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
}

.stats-row {
  display: flex;
  background: var(--vino-card);
  padding: 20px 0;
  margin-bottom: 8px;
}

.stat-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-dark);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 12px;
  color: var(--vino-text-secondary);
  font-weight: 500;
}

.menu-group {
  margin: 0 12px 8px !important;
  border-radius: var(--vino-radius) !important;
  overflow: hidden;
}

.menu-group :deep(.van-cell) {
  padding: 15px 20px;
}

.menu-group :deep(.van-cell__title) {
  font-size: 15px;
  font-weight: 500;
  color: var(--vino-dark);
}

.menu-group :deep(.van-cell:active) {
  background: var(--vino-bg);
}

.logout-area {
  padding: 24px 20px;
}

.logout-btn {
  border-radius: var(--vino-radius-sm) !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  color: var(--vino-text-secondary) !important;
  border-color: var(--vino-border) !important;
}
</style>
