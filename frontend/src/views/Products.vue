<template>
  <div class="products-page">
    <PageThemeLayer path="/products" />

    <div class="products-body">
      <div class="products-search-wrap">
        <div class="products-search-inner">
          <van-icon name="search" class="products-search-icon" />
          <input
            v-model.trim="searchKeyword"
            type="search"
            class="products-search-input"
            :placeholder="t('products.searchPlaceholder')"
            enterkeyhint="search"
            autocomplete="off"
          />
        </div>
      </div>

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
            {{ pick(cat, 'name') }}
          </button>
        </aside>
        <div class="product-main">
          <div v-if="currentCategoryBannerSrc" class="category-banner">
            <LodImg
              :src="currentCategoryBannerSrc"
              :thumb="currentCategoryBannerThumb"
              class="category-banner-img"
              alt=""
            />
          </div>

          <van-loading v-if="listLoading" size="28" class="main-loading" />
          <div v-else-if="filteredDeviceGuides.length" class="product-grid">
            <button
              v-for="d in filteredDeviceGuides"
              :key="d.id"
              type="button"
              class="grid-card"
              @click="openGuide(d)"
            >
              <div class="grid-card-row">
                <div class="grid-card-icon">
                  <LodImg
                    v-if="d.iconUrl"
                    :src="fullUrl(d.iconUrl)"
                    class="grid-card-icon-img"
                  />
                  <van-icon v-else :name="d.icon || 'photo-o'" size="28" color="#6b7280" />
                </div>
                <span class="grid-card-name">{{ pick(d, 'name') }}</span>
              </div>
            </button>
          </div>
          <div v-else-if="selectedCategoryId && !listLoading && sortedDeviceGuides.length && !filteredDeviceGuides.length" class="main-empty">
            {{ t('products.emptyNoMatch') }}
          </div>
          <div v-else-if="selectedCategoryId && !listLoading && !sortedDeviceGuides.length" class="main-empty">{{ t('products.emptyCategoryEmpty') }}</div>
        </div>
      </div>

      <div v-if="!listLoading && !sortedCategories.length" class="empty-hint">
        <van-icon name="info-o" size="48" color="#ccc" />
        <p>{{ t('products.emptyNoConfig') }}</p>
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
import { pick, t } from '@/utils/i18n';
import {
  sortGuidesByDisplayOrder,
  sortCategoriesForSidebar,
} from '@/utils/productGuideOrder';

const router = useRouter();

const categories = ref([]);
const selectedCategoryId = ref(null);
const deviceGuides = ref([]);
const listLoading = ref(false);
const searchKeyword = ref('');

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

const sortedCategories = computed(() => sortCategoriesForSidebar(categories.value));

const currentCategoryName = computed(() => {
  const c = categories.value.find((x) => x.id === selectedCategoryId.value);
  return c ? c.name : '';
});

const sortedDeviceGuides = computed(() =>
  sortGuidesByDisplayOrder(deviceGuides.value, currentCategoryName.value)
);

const filteredDeviceGuides = computed(() => {
  const list = sortedDeviceGuides.value;
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((d) => {
    const hay = [d.name, d.nameEn, d.slug].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(kw);
  });
});

const currentCategory = computed(() =>
  categories.value.find((x) => x.id === selectedCategoryId.value) || null
);

const currentCategoryBannerSrc = computed(() => {
  const u = pick(currentCategory.value, 'thumbnailUrl');
  if (!u || !String(u).trim()) return '';
  return fullUrl(String(u).trim());
});

const currentCategoryBannerThumb = computed(() => currentCategoryBannerSrc.value);

function openGuide(d) {
  const idOrSlug = d.slug || d.id;
  router.push(`/guide/${encodeURIComponent(String(idOrSlug))}`);
}

const selectCategory = async (cat) => {
  if (selectedCategoryId.value === cat.id) return;
  selectedCategoryId.value = cat.id;
  searchKeyword.value = '';
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

.products-search-wrap {
  padding: 10px 12px 12px;
  box-sizing: border-box;
}

.products-search-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #2d2d33;
  border-radius: 10px;
  padding: 10px 14px;
  box-sizing: border-box;
}

.products-search-icon {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 18px;
}

.products-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #f3f4f6;
  font-size: 15px;
  outline: none;
}

.products-search-input::placeholder {
  color: #9ca3af;
}

.products-bottom-space {
  height: 56px;
}

.products-layout {
  display: flex;
  align-items: stretch;
  min-height: 200px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.product-sidebar {
  flex-shrink: 0;
  width: 96px;
  padding: 0;
  background: #f7f6f2;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0;
  align-items: stretch;
}

.sidebar-item {
  margin: 0;
  padding: 14px 10px 14px 12px;
  border: none;
  border-radius: 0;
  border-left: 3px solid transparent;
  box-sizing: border-box;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1.35;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-item.active {
  background: #e8e8e8;
  border-left-color: #07c160;
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

.category-banner {
  width: 100%;
  margin-bottom: 12px;
  border-radius: 12px;
  overflow: hidden;
  line-height: 0;
  background: #e5e7eb;
}

.category-banner-img {
  width: 100%;
  height: auto;
  display: block;
  vertical-align: top;
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
  display: flex;
  flex-direction: column;
  gap: 0;
}

.grid-card {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.grid-card:active {
  opacity: 0.92;
}

.grid-card-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  width: 100%;
  padding: 14px 0 12px;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.grid-card:last-child .grid-card-row {
  border-bottom: none;
}

/* 商品图独占一行，宽度贴齐主内容区，高度随素材、上限接近分类横幅区 */
.grid-card-icon {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.grid-card-icon-img {
  width: 100%;
  max-width: 100%;
  height: auto;
  max-height: 240px;
  object-fit: contain;
  display: block;
  vertical-align: top;
}

.grid-card-name {
  width: 100%;
  margin-top: 10px;
  padding: 0 4px;
  box-sizing: border-box;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  text-align: center;
  line-height: 1.45;
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
