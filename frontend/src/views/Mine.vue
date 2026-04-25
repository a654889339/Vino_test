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

    <section class="mine-section order-section">
      <div class="section-head">
        <h3>{{ t('我的订单', 'My Orders') }}</h3>
        <button type="button" class="section-link" @click="openGoodsOrders()">{{ t('查看全部订单', 'View All') }} ›</button>
      </div>
      <div class="order-card">
        <div class="order-stat-item" v-for="s in stats" :key="s.key" @click="openGoodsOrders(s.key)">
          <div class="order-icon-wrap">
            <van-icon :name="s.icon" size="22" />
            <span v-if="s.value > 0" class="order-badge">{{ s.value }}</span>
          </div>
          <span class="order-stat-label">{{ s.label }}</span>
        </div>
      </div>
    </section>

    <section class="mine-section cart-section">
      <div class="section-head">
        <h3>{{ t('我的购物车', 'My Cart') }}</h3>
        <button type="button" class="section-link" @click="router.push('/cart')">{{ t('查看', 'View') }} ›</button>
      </div>
      <div class="cart-summary-card" @click="router.push('/cart')">
        <div class="cart-preview-list" v-if="cartPreviewItems.length">
          <div class="cart-preview-item" v-for="item in cartPreviewItems" :key="item.guideId">
            <img v-if="cartLineImage(item)" :src="fullUrl(cartLineImage(item))" alt="" />
            <van-icon v-else name="photo-o" size="28" color="#cbd5e1" />
          </div>
        </div>
        <div class="cart-empty-preview" v-else>{{ t('购物车是空的', 'Cart is empty') }}</div>
        <div class="cart-total-text">{{ t('共', 'Total') }} {{ cartTotalCount }} {{ t('件', 'items') }}</div>
      </div>
    </section>

    <van-cell-group inset class="menu-group">
      <van-cell :title="isEn ? 'Service orders' : '服务订单'" icon="orders-o" is-link to="/orders" />
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
import { cartApi, goodsOrderApi, homeConfigApi } from '@/api';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import { copyTextToClipboardSync } from '@/utils/clipboard';
import { t, isEn } from '@/utils/i18n';

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

const goodsOrderStats = ref({
  pendingPay: 0,
  pendingShipment: 0,
  pendingReceipt: 0,
  pendingReview: 0,
  afterSales: 0,
});
const cartPreviewItems = ref([]);
const cartTotalCount = ref(0);

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
  { key: 'pendingPay', label: t('待付款', 'Pending'), value: goodsOrderStats.value.pendingPay, icon: 'balance-pay' },
  { key: 'pendingShipment', label: t('待发货', 'To Ship'), value: goodsOrderStats.value.pendingShipment, icon: 'logistics' },
  { key: 'pendingReceipt', label: t('待收货', 'To Receive'), value: goodsOrderStats.value.pendingReceipt, icon: 'completed' },
  { key: 'pendingReview', label: t('待评价', 'To Review'), value: goodsOrderStats.value.pendingReview, icon: 'comment-o' },
  { key: 'afterSales', label: t('退款/售后', 'Refund/After-sales'), value: goodsOrderStats.value.afterSales, icon: 'replay' },
]);

const GOODS_ORDER_STAT_GROUPS = {
  pendingPay: ['pending'],
  pendingShipment: ['paid'],
  pendingReceipt: ['processing'],
  pendingReview: ['completed'],
  afterSales: ['after_sale', 'after-sales', 'refund', 'refunding', 'refunded'],
};

const emptyGoodsOrderStats = () => ({
  pendingPay: 0,
  pendingShipment: 0,
  pendingReceipt: 0,
  pendingReview: 0,
  afterSales: 0,
});

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

function cartLineImage(row) {
  if (!row) return '';
  return row.imageUrl || row.imageURL || '';
}

const openGoodsOrders = (statusGroup) => {
  router.push(statusGroup ? { path: '/goods-orders', query: { statusGroup } } : { path: '/goods-orders' });
};

const loadGoodsOrderStats = async () => {
  if (!userStore.isLoggedIn) {
    goodsOrderStats.value = emptyGoodsOrderStats();
    return;
  }
  try {
    const entries = await Promise.all(Object.entries(GOODS_ORDER_STAT_GROUPS).map(async ([key, statuses]) => {
      const totals = await Promise.all(statuses.map(async (status) => {
        try {
          const res = await goodsOrderApi.list({ status, page: 1, pageSize: 1 });
          return Number(res.data?.total || 0);
        } catch {
          return 0;
        }
      }));
      return [key, totals.reduce((sum, n) => sum + n, 0)];
    }));
    goodsOrderStats.value = Object.fromEntries(entries);
  } catch {
    goodsOrderStats.value = emptyGoodsOrderStats();
  }
};

const loadCartSummary = async () => {
  if (!userStore.isLoggedIn) {
    cartPreviewItems.value = [];
    cartTotalCount.value = 0;
    return;
  }
  try {
    const res = await cartApi.get();
    const d = res.data || {};
    const items = Array.isArray(d.items) ? d.items : [];
    cartPreviewItems.value = items.slice(0, 3);
    cartTotalCount.value = Number(d.totalCount || items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0));
  } catch {
    cartPreviewItems.value = [];
    cartTotalCount.value = 0;
  }
};

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
  loadGoodsOrderStats();
  loadCartSummary();
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

.mine-section {
  position: relative;
  z-index: 1;
  margin: 0 12px 14px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 9px;
}

.section-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--vino-dark);
}

.section-link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--vino-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.order-card,
.cart-summary-card {
  background: var(--vino-card);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.order-card {
  display: flex;
  padding: 16px 8px;
}

.order-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #0f4f3c;
  cursor: pointer;
}

.order-icon-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.order-badge {
  position: absolute;
  top: -8px;
  right: -14px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef5b63;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.order-stat-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--vino-dark);
}

.cart-summary-card {
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
}

.cart-preview-list {
  flex: 1;
  display: flex;
  gap: 10px;
  min-width: 0;
}

.cart-preview-item {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: #f1f5f9;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cart-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cart-empty-preview {
  flex: 1;
  color: var(--vino-text-secondary);
  font-size: 13px;
}

.cart-total-text {
  flex-shrink: 0;
  color: var(--vino-text-secondary);
  font-size: 14px;
  white-space: nowrap;
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
