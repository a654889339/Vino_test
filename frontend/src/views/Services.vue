<template>
  <div class="services-page">
    <PageThemeLayer path="/services" />

    <div class="svc-body">
      <div v-for="cat in categories" :key="cat.key" class="svc-section">
        <h3 class="svc-section-title">{{ pick(cat, 'name') }}</h3>
        <div class="svc-card">
          <div class="svc-grid">
            <div
              v-for="item in cat.items"
              :key="item.id"
              class="svc-grid-item"
              @click="$router.push(`/service/${item.id}`)"
            >
              <div class="svc-icon-wrap">
                <img v-if="item.iconUrl" :src="item.iconUrl" class="svc-icon-img" alt="" />
                <van-icon v-else :name="item.icon" size="28" color="rgba(255,255,255,0.85)" />
              </div>
              <span class="svc-item-name">{{ pick(item, 'title') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div style="height: 80px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { serviceApi } from '@/api';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import { pick, t } from '@/utils/i18n';

const categories = ref([]);

const fallbackCategories = [
  { key: 'repair', name: t('services.repair'), items: [
    { id: 1, title: t('services.deviceRepair'), desc: '', icon: 'setting-o', iconUrl: '', bg: '#B91C1C' },
    { id: 2, title: t('services.onSiteRepair'), desc: '', icon: 'location-o', iconUrl: '', bg: '#DC2626' },
    { id: 3, title: t('services.remoteSupport'), desc: '', icon: 'phone-o', iconUrl: '', bg: '#EF4444' },
  ]},
  { key: 'clean', name: t('services.clean'), items: [
    { id: 4, title: t('services.deepClean'), desc: '', icon: 'brush-o', iconUrl: '', bg: '#2563EB' },
    { id: 5, title: t('services.dailyClean'), desc: '', icon: 'smile-o', iconUrl: '', bg: '#3B82F6' },
  ]},
  { key: 'inspect', name: t('services.inspect'), items: [
    // 与 i18n_texts / Node 种子一致：fullInspection、performanceOpt（勿用 fullInspect / optimize）
    { id: 6, title: t('services.fullInspection'), desc: '', icon: 'scan', iconUrl: '', bg: '#059669' },
    { id: 7, title: t('services.performanceOpt'), desc: '', icon: 'fire-o', iconUrl: '', bg: '#10B981' },
  ]},
  { key: 'data', name: t('services.data'), items: [
    { id: 8, title: t('services.dataRecovery'), desc: '', icon: 'replay', iconUrl: '', bg: '#7C3AED' },
    { id: 9, title: t('services.dataBackup'), desc: '', icon: 'description', iconUrl: '', bg: '#8B5CF6' },
  ]},
];

const categoryColors = { repair: '#B91C1C', clean: '#2563EB', inspect: '#059669', data: '#7C3AED' };

onMounted(async () => {
  try {
    const res = await serviceApi.list();
    const services = res.data?.list || res.data || [];
    if (services.length) {
      const catMap = {};
      services.forEach(s => {
        const cat = s.serviceCategory || s.category;
        const catKey = cat?.key ?? cat?.id ?? (typeof cat === 'string' ? cat : 'repair');
        const catName = cat?.name ?? (typeof cat === 'string' ? cat : t('services.repairFallback'));
        if (!catMap[catKey]) {
          catMap[catKey] = {
            key: String(catKey),
            name: catName,
            nameEn: cat?.nameEn,
            items: [],
          };
        }
        catMap[catKey].items.push({
          ...s,
          id: s.id,
          title: s.title,
          desc: s.description || '',
          icon: s.icon || 'setting-o',
          iconUrl: s.iconUrl || '',
          bg: s.bg || categoryColors[catKey] || '#B91C1C',
        });
      });
      categories.value = Object.values(catMap);
    } else {
      categories.value = fallbackCategories;
    }
  } catch {
    categories.value = fallbackCategories;
  }
});
</script>

<style scoped>
.services-page {
  position: relative;
  background: var(--vino-bg, #f5f5f5);
  min-height: 100vh;
}

.svc-body {
  padding: 16px 16px 0;
  position: relative;
  z-index: 1;
}

.svc-section {
  margin-bottom: 20px;
}

.svc-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vino-text-secondary, #666);
  margin-bottom: 10px;
  padding-left: 4px;
}

.svc-card {
  background: #2a2a2e;
  border-radius: 16px;
  padding: 20px 12px 8px;
}

.svc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px 0;
}

.svc-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px 14px;
  cursor: pointer;
  border-radius: 12px;
  transition: background 0.2s;
}

.svc-grid-item:active {
  background: rgba(255, 255, 255, 0.08);
}

.svc-icon-wrap {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.svc-icon-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: brightness(0) invert(1) opacity(0.85);
}

.svc-item-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
