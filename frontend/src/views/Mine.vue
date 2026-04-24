<template>
  <div class="mine-page">
    <PageThemeLayer path="/mine" />
    <div
      class="profile-header"
      :style="profileHeaderStyle"
      @click="onProfileHeaderClick"
    >
      <div class="avatar">
        <img v-if="userStore.isLoggedIn && userStore.userInfo?.avatar" :src="userStore.userInfo.avatar" class="avatar-img" alt="" />
        <span v-else-if="userStore.isLoggedIn && (userStore.userInfo?.nickname || userStore.userInfo?.username)" class="avatar-initial">{{ (userStore.userInfo?.nickname || userStore.userInfo?.username).charAt(0) }}</span>
        <van-icon v-else name="user-o" size="36" color="#fff" />
      </div>
      <div class="profile-info" v-if="userStore.isLoggedIn">
        <h3>{{ userStore.userInfo?.nickname || userStore.userInfo?.username || t('mine.user') }}</h3>
        <p>{{ profileSubtitle }}</p>
      </div>
      <div class="profile-info" v-else>
        <h3>{{ t('mine.tapLogin') }}</h3>
        <p>{{ t('mine.loginBenefits') }}</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-item" v-for="s in stats" :key="s.label">
        <span class="stat-num">{{ s.value }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </div>
    </div>

    <van-cell-group inset class="menu-group">
      <van-cell :title="t('mine.orders')" icon="orders-o" is-link to="/orders" />
      <van-cell title="商品订单" icon="bag-o" is-link to="/goods-orders" />
      <van-cell :title="t('mine.products')" icon="bag-o" is-link to="/mine/products" />
      <van-cell :title="t('mine.address')" icon="location-o" is-link to="/address" />
    </van-cell-group>

    <van-cell-group inset class="menu-group">
      <van-cell :title="t('mine.feedback')" icon="comment-o" is-link @click="openFeedback" />
      <van-cell :title="t('mine.about')" icon="info-o" is-link @click="openAbout" />
      <van-cell :title="t('mine.contact')" icon="phone-o" is-link @click="openContact" />
    </van-cell-group>

    <div class="logout-area" v-if="userStore.isLoggedIn">
      <van-button block plain type="default" class="logout-btn" @click="handleLogout">{{ t('mine.logout') }}</van-button>
    </div>

    <div class="mine-tabbar-spacer"></div>

    <van-dialog
      v-model:show="contactDialogVisible"
      :title="t('mine.contactTitle')"
      :message="t('mine.contactPhone') + CONTACT_PHONE"
      show-cancel-button
      :cancel-button-text="t('common.close')"
      :confirm-button-text="t('common.copy')"
      @confirm="onContactCopy"
    />
  </div>
</template>

<script setup>
import { ref, inject, onMounted, computed } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { homeConfigApi } from '@/api';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import { copyTextToClipboardSync } from '@/utils/clipboard';
import { t } from '@/utils/i18n';

const userStore = useUserStore();
const router = useRouter();
const chatWidgetRef = inject('chatWidget', ref(null));

const profileSubtitle = computed(() => {
  const u = userStore.userInfo;
  if (!u) return t('mine.noPhone');
  if (u.phone) return u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  if (u.email) return u.email;
  return t('mine.noPhone');
});

const onProfileHeaderClick = () => {
  if (userStore.isLoggedIn) {
    router.push('/mine/profile');
  } else {
    router.push('/login');
  }
};

const mineBgImageUrl = ref('');
const profileHeaderStyle = computed(() => {
  if (mineBgImageUrl.value) {
    return {
      backgroundImage: `url(${mineBgImageUrl.value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return {
    background: 'linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%)',
  };
});

const openFeedback = () => {
  if (chatWidgetRef.value) {
    chatWidgetRef.value.openWithAutoMessage('');
  }
};

const openAbout = () => {
  window.open('https://www.vinotech.cn/', '_blank');
};

const CONTACT_PHONE = '400-8030-683';
const contactDialogVisible = ref(false);

const openContact = () => {
  contactDialogVisible.value = true;
};

/** 由 van-dialog「复制」直接触发，保持与 iOS 用户手势同步 */
const onContactCopy = () => {
  const ok = copyTextToClipboardSync(CONTACT_PHONE);
  if (ok) {
    showToast(t('mine.copied'));
    contactDialogVisible.value = false;
  } else {
    showToast(t('mine.copyFailed'));
  }
};

const stats = computed(() => [
  { label: t('mine.pendingPay'), value: 0 },
  { label: t('mine.inProgress'), value: 0 },
  { label: t('mine.pendingReview'), value: 0 },
  { label: t('mine.afterSales'), value: 0 },
]);

onMounted(async () => {
  if (userStore.isLoggedIn && !userStore.userInfo) {
    try {
      await userStore.fetchProfile();
    } catch {
      userStore.logout();
    }
  }
  try {
    const res = await homeConfigApi.list();
    const items = res.data || [];
    const mineBg = items.find(i => i.section === 'mineBg' && i.status === 'active');
    if (mineBg && mineBg.imageUrl) mineBgImageUrl.value = mineBg.imageUrl;
  } catch (_) {}
});

const handleLogout = () => {
  userStore.logout();
  router.push('/');
};
</script>

<style scoped>
.mine-page {
  position: relative;
  background: var(--vino-bg);
  min-height: 100vh;
}

.profile-header {
  position: relative;
  z-index: 1;
  background: linear-gradient(160deg, #1d1d1f 0%, #B91C1C 100%);
  padding: 48px 24px 36px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
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
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-initial {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
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
  position: relative;
  z-index: 1;
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
  position: relative;
  z-index: 1;
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
  position: relative;
  z-index: 1;
  padding: 24px 20px;
}

.logout-btn {
  border-radius: var(--vino-radius-sm) !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  color: var(--vino-text-secondary) !important;
  border-color: var(--vino-border) !important;
}

/* 与 App 底栏增高后的占位一致（约 50px→75px + 余量） */
.mine-tabbar-spacer {
  height: 96px;
}
</style>
