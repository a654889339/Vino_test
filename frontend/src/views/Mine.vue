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
      <van-cell title="地址管理" icon="location-o" is-link />
      <van-cell title="优惠券" icon="coupon-o" is-link />
    </van-cell-group>

    <van-cell-group inset class="menu-group">
      <van-cell title="帮助中心" icon="question-o" is-link />
      <van-cell title="意见反馈" icon="comment-o" is-link />
      <van-cell title="关于Vino" icon="info-o" is-link />
    </van-cell-group>

    <div class="logout-area" v-if="userStore.isLoggedIn">
      <van-button block plain type="default" @click="handleLogout">退出登录</van-button>
    </div>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

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
  background: linear-gradient(135deg, #B91C1C, #7F1D1D);
  padding: 40px 20px 30px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-info h3 {
  color: #fff;
  font-size: 18px;
  margin-bottom: 4px;
}

.profile-info p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.stats-row {
  display: flex;
  background: var(--vino-card);
  padding: 16px 0;
  margin-bottom: 10px;
}

.stat-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-num {
  font-size: 18px;
  font-weight: 600;
}

.stat-label {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.menu-group {
  margin-bottom: 10px;
}

.logout-area {
  padding: 20px 16px;
}
</style>
