<template>
  <div class="detail-page">
    <van-nav-bar :title="t('serviceDetail.title')" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else>
      <div class="detail-cover">
        <div class="detail-cover-bg" :style="{ background: coverBg, opacity: coverOpacity }"></div>
        <img v-if="serviceIconUrl" :src="serviceIconUrl" class="detail-cover-icon-img" alt="" />
        <van-icon v-else :name="serviceIcon" size="60" color="#fff" />
      </div>

      <div class="detail-body">
        <h2>{{ pick(serviceData, 'title') }}</h2>
        <p class="detail-desc">{{ pick(serviceData, 'description') }}</p>

        <div v-if="shouldShowPrice(pick(serviceData, 'price')) || showOriginPrice" class="price-row">
          <span v-if="shouldShowPrice(pick(serviceData, 'price'))" class="detail-price">{{ formatPriceDisplay(pick(serviceData, 'price'), servicePriceCurrencyOverride) }}</span>
          <template v-if="showOriginPrice">
            <span class="origin-price">{{ formatPriceDisplay(pick(serviceData, 'originPrice'), servicePriceCurrencyOverride) }}</span>
            <van-tag type="primary" color="#B91C1C">{{ t('serviceDetail.promoTag') }}</van-tag>
          </template>
        </div>

        <van-divider />

        <h3>{{ t('serviceDetail.highlights') }}</h3>
        <div class="features">
          <div class="feature-item" v-for="f in features" :key="f.title">
            <van-icon :name="f.icon" size="20" color="#B91C1C" />
            <div>
              <h4>{{ f.title }}</h4>
              <p>{{ f.desc }}</p>
            </div>
          </div>
        </div>

        <van-divider />

        <h3>{{ t('serviceDetail.flow') }}</h3>
        <van-steps direction="vertical" :active="0" active-color="#B91C1C">
          <van-step>{{ t('serviceDetail.stepOrder') }}</van-step>
          <van-step>{{ t('serviceDetail.stepAccept') }}</van-step>
          <van-step>{{ t('serviceDetail.stepService') }}</van-step>
          <van-step>{{ t('serviceDetail.stepVerify') }}</van-step>
          <van-step>{{ t('serviceDetail.stepRate') }}</van-step>
        </van-steps>
      </div>

      <div class="detail-footer">
        <van-button icon="chat-o" type="default" size="small" @click="onConsult">{{ t('serviceDetail.consult') }}</van-button>
        <van-button type="primary" color="#B91C1C" block round @click="onBookClick">
          {{ t('serviceDetail.bookNow') }}
        </van-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { serviceApi } from '@/api';
import { showDialog } from 'vant';
import { formatPriceDisplay, shouldShowPrice } from '@/utils/currency';
import { pick, t } from '@/utils/i18n';

const route = useRoute();
const router = useRouter();
const chatWidgetRef = inject('chatWidget', ref(null));
const loading = ref(true);

const onConsult = () => {
  const s = serviceData.value;
  const displayPrice = pick(s, 'price');
  const sym = pick(s, 'currency');
  const currencyOv = sym && String(sym).trim() ? String(sym).trim() : null;
  const pricePart = Number(displayPrice) !== 0 && displayPrice != null && displayPrice !== ''
    ? `（${formatPriceDisplay(displayPrice, currencyOv)}）`
    : '';
  const title = pick(s, 'title') || t('serviceDetail.thisService');
  const desc = pick(s, 'description');
  const msg = `${t('serviceDetail.consultMsgPrefix')}【${title}】${pricePart}${desc ? ': ' + desc : ''}`;
  if (chatWidgetRef.value) {
    chatWidgetRef.value.openWithAutoMessage(msg);
  }
};

const onBookClick = () => {
  const token = localStorage.getItem('vino_token');
  const id = route.params.id;
  if (!token) {
    showDialog({ title: t('serviceDetail.loginTitle'), message: t('serviceDetail.loginMsg') }).then(() => {
      router.push({ path: '/login', query: { redirect: `/service/${id}/book` } });
    });
    return;
  }
  router.push({ name: 'ServiceBook', params: { id } });
};

const fallbackServices = {
  1: { title: t('services.deviceRepair'), description: t('services.deviceRepairDesc'), price: '99', originPrice: '159', icon: 'setting-o', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
  2: { title: t('services.onSiteRepair'), description: t('services.onSiteRepairDesc'), price: '149', originPrice: '199', icon: 'location-o', bg: 'linear-gradient(135deg, #DC2626, #B91C1C)' },
  3: { title: t('services.remoteSupport'), description: t('services.remoteSupportDesc'), price: '29', originPrice: '49', icon: 'phone-o', bg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  4: { title: t('services.deepClean'), description: t('services.deepCleanDesc'), price: '149', originPrice: '199', icon: 'brush-o', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
  5: { title: t('services.dailyClean'), description: t('services.dailyCleanDesc'), price: '69', originPrice: '89', icon: 'smile-o', bg: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  6: { title: t('services.fullInspection'), description: t('services.fullInspectionDesc'), price: '49', originPrice: '79', icon: 'scan', bg: 'linear-gradient(135deg, #059669, #047857)' },
  7: { title: t('services.performanceOpt'), description: t('services.performanceOptDesc'), price: '79', originPrice: '129', icon: 'fire-o', bg: 'linear-gradient(135deg, #10B981, #059669)' },
  8: { title: t('services.dataRecovery'), description: t('services.dataRecoveryDesc'), price: '199', originPrice: '299', icon: 'replay', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
  9: { title: t('services.dataBackup'), description: t('services.dataBackupDesc'), price: '59', originPrice: '89', icon: 'description', bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
};

const serviceData = ref({ title: '', description: '', price: '0' });
const serviceIcon = ref('setting-o');
const serviceIconUrl = ref('');
const coverBg = ref('linear-gradient(135deg, #B91C1C, #7F1D1D)');
const coverOpacity = ref(1);

const servicePriceCurrencyOverride = computed(() => {
  const c = pick(serviceData.value, 'currency');
  return c && String(c).trim() ? String(c).trim() : null;
});

const showOriginPrice = computed(() => {
  const op = pick(serviceData.value, 'originPrice');
  return op != null && op !== '' && Number(op) > 0;
});

const features = [
  { title: t('serviceDetail.highlight1'), desc: t('serviceDetail.highlight1Desc'), icon: 'shield-o' },
  { title: t('serviceDetail.highlight2'), desc: t('serviceDetail.highlight2Desc'), icon: 'clock-o' },
  { title: t('serviceDetail.highlight3'), desc: t('serviceDetail.highlight3Desc'), icon: 'balance-list-o' },
  { title: t('serviceDetail.highlight4'), desc: t('serviceDetail.highlight4Desc'), icon: 'certificate' },
];

onMounted(async () => {
  const id = route.params.id;
  try {
    const res = await serviceApi.detail(id);
    const d = res.data;
    serviceData.value = { ...d };
    serviceIcon.value = d.icon || 'setting-o';
    serviceIconUrl.value = d.iconUrl || '';
    coverBg.value = d.bg || 'linear-gradient(135deg, #B91C1C, #7F1D1D)';
    coverOpacity.value = d.bgOpacity != null ? Number(d.bgOpacity) / 100 : 1;
  } catch {
    const fb = fallbackServices[id] || fallbackServices[1];
    serviceData.value = { title: fb.title, description: fb.description, price: fb.price, originPrice: fb.originPrice };
    serviceIcon.value = fb.icon;
    serviceIconUrl.value = '';
    coverBg.value = fb.bg;
    coverOpacity.value = 1;
  } finally {
    loading.value = false;
  }
});

</script>

<style scoped>
.detail-page {
  background: var(--vino-bg);
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-loading {
  padding-top: 120px;
  text-align: center;
}

.detail-cover {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.detail-cover-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.detail-cover .detail-cover-icon-img,
.detail-cover .van-icon {
  position: relative;
  z-index: 1;
}

.detail-cover-icon-img {
  max-width: 80px;
  max-height: 80px;
  object-fit: contain;
}

.detail-body {
  background: var(--vino-card);
  border-radius: 16px 16px 0 0;
  margin-top: -20px;
  position: relative;
  padding: 24px 16px;
}

.detail-body h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.detail-desc {
  font-size: 14px;
  color: var(--vino-text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-price {
  font-size: 24px;
  font-weight: 700;
  color: var(--vino-primary);
}

.origin-price {
  font-size: 14px;
  color: #ccc;
  text-decoration: line-through;
}

.detail-body h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.feature-item h4 {
  font-size: 14px;
  margin-bottom: 2px;
}

.feature-item p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.detail-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  margin: 0 auto;
  background: var(--vino-card);
  padding: 10px 16px;
  display: flex;
  gap: 10px;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.detail-footer .van-button--default {
  flex-shrink: 0;
}

.detail-footer .van-button--primary {
  flex: 1;
}
</style>
