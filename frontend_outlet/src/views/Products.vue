<template>
  <div class="products-page">
    <PageThemeLayer path="/products" />

    <div class="products-body">
      <div class="products-layout">
        <aside class="product-sidebar" v-if="sortedCategories.length">
          <button
            v-for="cat in sortedCategories"
            :key="cat.id"
            type="button"
            class="sidebar-item"
            :class="{ active: selectedCategoryId === cat.id }"
            @click="selectCategory(cat)"
          >
            {{ cat.name }}
          </button>
        </aside>
        <div class="product-main">
          <van-loading v-if="listLoading" size="28" class="main-loading" />
          <div v-else-if="sortedDeviceGuides.length" class="product-grid">
            <button
              v-for="d in sortedDeviceGuides"
              :key="d.id"
              type="button"
              class="grid-card"
              @click="openGuide(d)"
            >
              <div class="grid-card-icon">
                <LodImg
                  v-if="d.iconUrl"
                  :src="fullUrl(d.iconUrl)"
                  :thumb="d.iconUrlThumb ? fullUrl(d.iconUrlThumb) : ''"
                  class="grid-card-icon-img"
                />
                <van-icon v-else :name="d.icon || 'photo-o'" size="28" color="#6b7280" />
              </div>
              <span class="grid-card-name">{{ d.name }}</span>
            </button>
          </div>
          <div v-else-if="selectedCategoryId && !listLoading" class="main-empty">该种类下暂无商品</div>
        </div>
      </div>

      <div v-if="!listLoading && !sortedCategories.length" class="empty-hint">
        <van-icon name="info-o" size="48" color="#ccc" />
        <p>暂无商品配置</p>
      </div>

      <div class="products-bottom-space" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { guideApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import {
  sortGuidesByDisplayOrder,
  sortCategoriesForSidebar,
} from '@/utils/productGuideOrder';

const router = useRouter();

const categories = ref([]);
const selectedCategoryId = ref(null);
const deviceGuides = ref([]);
const listLoading = ref(false);

const sortedCategories = computed(() => sortCategoriesForSidebar(categories.value));

const currentCategoryName = computed(() => {
  const c = categories.value.find((x) => x.id === selectedCategoryId.value);
  return c ? c.name : '';
});

const sortedDeviceGuides = computed(() =>
  sortGuidesByDisplayOrder(deviceGuides.value, currentCategoryName.value)
);

const BASE = import.meta.env.VITE_API_BASE || '';
const fullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
};

function openGuide(d) {
  const idOrSlug = d.slug || d.id;
  router.push(`/guide/${encodeURIComponent(String(idOrSlug))}`);
}

const selectCategory = async (cat) => {
  if (selectedCategoryId.value === cat.id) return;
  selectedCategoryId.value = cat.id;
  listLoading.value = true;
  try {
    const res = await guideApi.list({ categoryId: cat.id });
    deviceGuides.value = res.data || [];
  } catch {
    deviceGuides.value = [];
  }
  listLoading.value = false;
};

onMounted(async () => {
  document.title = 'Vino服务';
  try {
    const res = await guideApi.categories();
    categories.value = res.data || [];
    const sorted = sortCategoriesForSidebar(categories.value);
    if (sorted.length) {
      const first = sorted[0];
      selectedCategoryId.value = first.id;
      listLoading.value = true;
      try {
        const listRes = await guideApi.list({ categoryId: first.id });
        deviceGuides.value = listRes.data || [];
      } catch {
        deviceGuides.value = [];
      }
      listLoading.value = false;
    }
  } catch {
    /* empty */
  }
});
</script>

<style scoped>
.products-page {
  position: relative;
  background: #e8e8ed;
  min-height: 100vh;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.products-body {
  position: relative;
  z-index: 1;
  padding-top: 0;
}

.products-bottom-space {
  height: 56px;
}

.products-layout {
  display: flex;
  align-items: stretch;
  min-height: 240px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.product-sidebar {
  flex-shrink: 0;
  width: 96px;
  padding: 12px 0;
  background: #eef0f3;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.sidebar-item {
  margin: 0 8px;
  padding: 12px 8px;
  border: none;
  border-radius: 999px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  line-height: 1.35;
  text-align: center;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-item.active {
  background: rgba(255, 183, 77, 0.45);
  color: #111827;
  font-weight: 600;
}

.sidebar-item:active {
  opacity: 0.88;
}

.product-main {
  flex: 1;
  min-width: 0;
  padding: 12px;
  background: #fafafa;
}

.main-loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.main-empty {
  text-align: center;
  padding: 32px 12px;
  font-size: 14px;
  color: #6b7280;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.grid-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  min-height: 104px;
  -webkit-tap-highlight-color: transparent;
}

.grid-card:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.grid-card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #f3f4f6;
  overflow: hidden;
}

.grid-card-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.grid-card-name {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  text-align: center;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-hint {
  text-align: center;
  padding: 48px 16px;
  color: #6b7280;
}

.empty-hint p {
  margin-top: 12px;
  font-size: 15px;
}
</style>
