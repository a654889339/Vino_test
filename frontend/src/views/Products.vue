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
          <button type="button" class="products-cart-btn" @click="goCart">
            <van-icon name="cart-o" size="18" />
            <span class="products-cart-text">购物车</span>
            <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
          </button>
        </div>
      </div>

      <nav
        v-if="sortedCategories.length"
        class="product-tabs"
        ref="tabBarRef"
      >
        <button
          v-for="cat in sortedCategories"
          :key="cat.id"
          type="button"
          class="tab-item"
          :class="{ active: selectedCategoryId === cat.id }"
          :ref="(el) => setTabRef(cat.id, el)"
          @click="selectCategory(cat)"
        >
          {{ pick(cat, 'name') }}
        </button>
      </nav>

      <div class="products-layout">
        <div
          class="product-main"
          @touchstart="onMainTouchStart"
          @touchmove="onMainTouchMove"
          @touchend="onMainTouchEnd"
          @touchcancel="onMainTouchEnd"
        >
          <div class="product-carousel">
            <div
              class="product-carousel-track"
              :class="{ dragging: isDragging }"
              :style="carouselTrackStyle"
            >
              <section
                v-for="cat in sortedCategories"
                :key="cat.id"
                class="product-carousel-page"
              >
                <div v-if="categoryBannerSrc(cat)" class="category-banner">
                  <LodImg
                    :src="categoryBannerSrc(cat)"
                    :thumb="categoryBannerSrc(cat)"
                    class="category-banner-img"
                    alt=""
                  />
                </div>

                <van-loading v-if="isCategoryLoading(cat.id)" size="28" class="main-loading" />
                <div v-else-if="filteredGuidesForCategory(cat).length" class="product-grid">
                  <button
                    v-for="d in filteredGuidesForCategory(cat)"
                    :key="d.id"
                    type="button"
                    class="grid-card"
                    @click="openGuide(d)"
                  >
                    <div class="grid-card-row">
                      <div class="grid-card-thumb">
                        <LodImg
                          v-if="cardImage(d)"
                          :src="cardImage(d)"
                          class="grid-card-thumb-img"
                          alt=""
                        />
                        <van-icon v-else :name="d.icon || 'photo-o'" size="28" color="#6b7280" />
                      </div>

                      <div class="grid-card-body">
                        <div class="grid-card-title">{{ pick(d, 'name') }}</div>
                        <div class="grid-card-subtitle">{{ pick(d, 'subtitle') || ' ' }}</div>
                        <div class="grid-card-desc">{{ pick(d, 'description') || ' ' }}</div>

                        <div class="grid-card-price-row">
                          <div class="grid-card-price">
                            <span v-if="shouldShowPrice(d.listPrice)" class="price-now">
                              {{ formatPriceDisplay(d.listPrice, d.currency) }}
                            </span>
                            <span v-else class="price-placeholder">—</span>
                            <span
                              v-if="shouldShowPrice(d.originPrice) && Number(d.originPrice) > Number(d.listPrice || 0)"
                              class="price-origin"
                            >
                              {{ formatPriceDisplay(d.originPrice, d.currency) }}
                            </span>
                          </div>
                          <button type="button" class="add-cart-btn" @click.stop="addToCart(d)">
                            <van-icon name="cart-o" size="18" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
                <div v-else-if="!isCategoryLoading(cat.id) && guidesForCategory(cat).length && !filteredGuidesForCategory(cat).length" class="main-empty">
                  {{ t('products.emptyNoMatch') }}
                </div>
                <div v-else-if="!isCategoryLoading(cat.id) && !guidesForCategory(cat).length" class="main-empty">
                  {{ t('products.emptyCategoryEmpty') }}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!sortedCategories.length" class="empty-hint">
        <van-icon name="info-o" size="48" color="#ccc" />
        <p>{{ t('products.emptyNoConfig') }}</p>
      </div>

      <div class="products-bottom-space" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { cartApi, guideApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import { pick, t } from '@/utils/i18n';
import { formatPriceDisplay, shouldShowPrice } from '@/utils/currency';
import { showToast } from 'vant';
import {
  sortGuidesByDisplayOrder,
  sortCategoriesForSidebar,
} from '@/utils/productGuideOrder';

const router = useRouter();

const categories = ref([]);
const selectedCategoryId = ref(null);
const categoryGuides = ref({});
const categoryLoading = ref({});
const searchKeyword = ref('');
const cartLines = ref([]);

const tabBarRef = ref(null);
const tabElMap = {};
function setTabRef(id, el) {
  if (el) tabElMap[id] = el;
}
function scrollActiveTabIntoView() {
  const el = tabElMap[selectedCategoryId.value];
  if (el && typeof el.scrollIntoView === 'function') {
    try {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    } catch {
      el.scrollIntoView();
    }
  }
}

const touchStartX = ref(0);
const touchStartY = ref(0);
const dragOffset = ref(0);
const isDragging = ref(false);
const trackTransition = ref(true);
function onMainTouchStart(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  touchStartX.value = t.clientX;
  touchStartY.value = t.clientY;
  dragOffset.value = 0;
  isDragging.value = true;
  trackTransition.value = false;
}
function onMainTouchMove(e) {
  if (!isDragging.value) return;
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  const dx = t.clientX - touchStartX.value;
  const dy = t.clientY - touchStartY.value;
  if (Math.abs(dy) > Math.abs(dx)) return;
  const idx = activeCategoryIndex.value;
  const maxLeft = idx === 0 ? 0 : 120;
  const maxRight = idx >= sortedCategories.value.length - 1 ? 0 : 120;
  dragOffset.value = Math.max(-maxRight, Math.min(maxLeft, dx));
}
function onMainTouchEnd(e) {
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  isDragging.value = false;
  trackTransition.value = true;
  if (!t) {
    dragOffset.value = 0;
    return;
  }
  const dx = t.clientX - touchStartX.value;
  const dy = t.clientY - touchStartY.value;
  dragOffset.value = 0;
  if (Math.abs(dx) < 60) return;
  if (Math.abs(dy) > 30) return;
  const list = sortedCategories.value;
  if (!list.length) return;
  const idx = list.findIndex((x) => x.id === selectedCategoryId.value);
  if (idx < 0) return;
  if (dx < 0) {
    const next = list[idx + 1];
    if (next) selectCategory(next);
  } else {
    const prev = list[idx - 1];
    if (prev) selectCategory(prev);
  }
}

const BASE = import.meta.env.VITE_API_BASE || '';
function fullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
}

function cardImage(d) {
  const cover = d && d.coverImage ? String(d.coverImage).trim() : '';
  const icon = d && d.iconUrl ? String(d.iconUrl).trim() : '';
  const u = cover || icon;
  return u ? fullUrl(u) : '';
}

async function loadCart() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    cartLines.value = [];
    return;
  }
  try {
    const res = await cartApi.get();
    cartLines.value = res.data?.items || [];
  } catch {
    cartLines.value = [];
  }
}

async function addToCart(d) {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  const gid = Number(d && d.id) || 0;
  if (!gid) return;
  if (!shouldShowPrice(d.listPrice)) {
    showToast('该商品暂未配置价格');
    return;
  }
  const items = (cartLines.value || []).map((x) => ({ guideId: Number(x.guideId), qty: Number(x.qty) || 1 }));
  const idx = items.findIndex((x) => Number(x.guideId) === gid);
  if (idx >= 0) items[idx].qty += 1;
  else items.push({ guideId: gid, qty: 1 });
  try {
    const res = await cartApi.put({ items });
    cartLines.value = res.data?.items || [];
    showToast('已加入购物车');
  } catch (e) {
    showToast(e?.message || '加入失败');
  }
}

function goCart() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showToast('请先登录');
    router.push('/login');
    return;
  }
  router.push('/cart');
}

const cartCount = computed(() => {
  return (cartLines.value || []).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
});

const sortedCategories = computed(() => sortCategoriesForSidebar(categories.value));

const activeCategoryIndex = computed(() => {
  const idx = sortedCategories.value.findIndex((x) => x.id === selectedCategoryId.value);
  return idx >= 0 ? idx : 0;
});

const carouselTrackStyle = computed(() => ({
  transform: `translateX(calc(${-activeCategoryIndex.value * 100}% + ${dragOffset.value}px))`,
  transition: trackTransition.value ? 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
}));

function categoryBannerSrc(cat) {
  const u = pick(cat, 'thumbnailUrl');
  if (!u || !String(u).trim()) return '';
  return fullUrl(String(u).trim());
}

function guidesForCategory(cat) {
  if (!cat) return [];
  return sortGuidesByDisplayOrder(categoryGuides.value[cat.id] || [], cat.name);
}

function filteredGuidesForCategory(cat) {
  const list = guidesForCategory(cat);
  if (cat && cat.id !== selectedCategoryId.value) return list;
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return list;
  return list.filter((d) => {
    const hay = [d.name, d.nameEn, d.slug].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(kw);
  });
}

function isCategoryLoading(id) {
  return !!categoryLoading.value[id];
}

function openGuide(d) {
  const idOrSlug = d.slug || d.id;
  router.push(`/guide/${encodeURIComponent(String(idOrSlug))}`);
}

async function loadGuidesForCategory(cat) {
  if (!cat || categoryGuides.value[cat.id] || categoryLoading.value[cat.id]) return;
  categoryLoading.value = { ...categoryLoading.value, [cat.id]: true };
  try {
    const res = await guideApi.list({ categoryId: cat.id });
    categoryGuides.value = { ...categoryGuides.value, [cat.id]: res.data || [] };
  } catch {
    categoryGuides.value = { ...categoryGuides.value, [cat.id]: [] };
  }
  categoryLoading.value = { ...categoryLoading.value, [cat.id]: false };
}

const selectCategory = async (cat) => {
  if (selectedCategoryId.value === cat.id) return;
  selectedCategoryId.value = cat.id;
  searchKeyword.value = '';
  nextTick(scrollActiveTabIntoView);
  await loadGuidesForCategory(cat);
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
      await loadGuidesForCategory(first);
      sorted.slice(1).forEach((cat) => loadGuidesForCategory(cat));
    }
  } catch {
    /* empty */
  }
  loadCart();
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

.products-cart-btn {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #f3f4f6;
}

.products-cart-text {
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  padding: 0 4px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 999px;
  text-align: center;
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

.product-tabs {
  display: flex;
  align-items: stretch;
  gap: 6px;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: #f3f4f6;
  padding: 6px;
  margin: 0 12px 10px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.product-tabs::-webkit-scrollbar {
  display: none;
}

.tab-item {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  padding: 12px 8px;
  border: none;
  border-radius: 12px;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: #4b5563;
  cursor: pointer;
  transition: color 0.2s, background 0.2s, box-shadow 0.2s;
  line-height: 1.35;
  text-align: center;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
}

.tab-item.active {
  color: #b91c1c;
  font-weight: 700;
  background: #ffffff;
  box-shadow: 0 6px 14px rgba(185, 28, 28, 0.16);
}

.tab-item:active {
  opacity: 0.85;
}

.products-layout {
  display: block;
  min-height: 200px;
  background: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.product-main {
  width: 100%;
  min-width: 0;
  background: #fafafa;
  box-sizing: border-box;
  touch-action: pan-y;
  overflow: hidden;
}

.product-carousel {
  width: 100%;
  overflow: hidden;
}

.product-carousel-track {
  display: flex;
  width: 100%;
  will-change: transform;
}

.product-carousel-track.dragging {
  cursor: grabbing;
}

.product-carousel-page {
  flex: 0 0 100%;
  width: 100%;
  min-width: 0;
  padding: 12px;
  box-sizing: border-box;
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
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 0;
  box-sizing: border-box;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.grid-card:last-child .grid-card-row {
  border-bottom: none;
}

/* 左侧方形缩略图，下方不放文字 */
.grid-card-thumb {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.grid-card-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.grid-card-body {
  flex: 1;
  min-width: 0;
  min-height: 100px;
  margin-top: 0;
  padding: 0 2px 0 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
}

.grid-card-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  text-align: left;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-align: left;
  line-height: 1.35;
  min-height: 1.35em;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-card-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
  text-align: left;
  line-height: 1.35;
  min-height: 1.35em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-card-price-row {
  margin-top: auto;
  padding-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.price-placeholder {
  font-size: 14px;
  color: #9ca3af;
  font-weight: 600;
}

.grid-card-price {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.price-now {
  color: #f59e0b;
  font-size: 16px;
  font-weight: 800;
}

.price-origin {
  color: #9ca3af;
  font-size: 12px;
  text-decoration: line-through;
}

.add-cart-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f97316;
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
