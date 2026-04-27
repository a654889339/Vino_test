<template>
  <div class="home">
    <PageThemeLayer :items="allItems" path="/" />
    <!-- 独立背景层：铺在整页最底层，红框处（卡片两侧）才能透出背景图 -->
    <div class="home-bg" aria-hidden="true">
      <van-swipe v-if="heroBgList.length" class="home-bg-swipe" :autoplay="4000" indicator-color="rgba(255,255,255,0.5)">
        <van-swipe-item v-for="(item, i) in heroBgList" :key="i">
          <LodImg v-if="item.url" :src="item.url" :thumb="item.thumb" class="home-bg-img" />
        </van-swipe-item>
      </van-swipe>
    </div>
    <!-- Hero 仅负责顶部 logo/分享，背景透明以露出 home-bg -->
    <div class="hero">
      <div class="hero-overlay">
        <div class="hero-header">
          <img v-if="headerLogoUrl" :src="headerLogoUrl" class="hero-logo" alt="Logo" />
          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="hero-logo-svg">
            <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#fff"/>
            <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#fff"/>
            <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#fff"/>
            <circle cx="420" cy="102" r="68" stroke="#fff" stroke-width="28" fill="none"/>
            <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#fff"/>
          </svg>
          <div class="hero-actions">
            <LangSwitcher />
            <div class="share-btn" @click="showShare = true">
              <van-icon name="share-o" size="18" color="#fff" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share QR Popup -->
    <van-overlay :show="showShare" @click="showShare = false">
      <div class="share-popup" @click.stop>
        <div class="share-card">
          <div class="share-card-header">
            <img v-if="headerLogoUrl" :src="headerLogoUrl" style="height:32px;object-fit:contain" />
            <span v-else style="color:#fff;font-weight:700;font-size:18px;letter-spacing:2px">VINO</span>
          </div>
          <div class="share-qr">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <p class="share-hint">{{ t('home.shareHint') }}</p>
          <div class="share-url">{{ shareUrl }}</div>
          <van-button size="small" round plain type="primary" color="#B91C1C" class="share-copy-btn" @click="copyUrl">{{ t('home.copyLink') }}</van-button>
        </div>
        <van-icon name="close" size="28" color="rgba(255,255,255,0.6)" class="share-close" @click="showShare = false" />
      </div>
    </van-overlay>

    <!-- 首页配置管理区域：仅此区域受「板块整体偏移」影响，不移动首页动画配置（背景/Logo/Hero） -->
    <div class="home-config-wrap" :style="homeSectionOffsetStyle">
      <div v-if="skinLayerHomeScroll" class="section-skin-layer" :style="skinLayerHomeScroll" aria-hidden="true" />
    <!-- 自助预约（仅此区块上移，与下方我的商品/热门服务同层级） -->
    <div class="home-config-inner">
    <div class="section card-section first-card" v-if="navLgItems.length || navSmItems.length" :style="firstCardSectionStyle">
      <div class="section-header">
        <h3>{{ navSectionTitle }}</h3>
        <span class="more" @click="$router.push('/services')">{{ t('home.progressQuery') }}</span>
      </div>
      <!-- 大图标行 -->
      <div class="nav-lg-row" v-if="navLgItems.length">
        <div class="nav-lg-item" v-for="item in navLgItems" :key="item.id" @click="$router.push(item.path)">
          <div class="nav-lg-icon">
            <img v-if="item.imageUrl" :src="item.imageUrlThumb || item.imageUrl" class="nav-lg-img" />
            <van-icon v-else :name="item.icon || 'apps-o'" size="36" :color="item.color || '#B91C1C'" />
          </div>
          <span class="nav-lg-label" :style="{ color: item.color || '#B91C1C' }">{{ item.title }}</span>
        </div>
      </div>
      <!-- 小图标行 -->
      <div class="nav-sm-row" v-if="navSmItems.length">
        <div class="nav-sm-item" v-for="item in navSmItems" :key="item.id" @click="$router.push(item.path)">
          <div class="nav-sm-icon">
            <img v-if="item.imageUrl" :src="item.imageUrlThumb || item.imageUrl" class="nav-sm-img" />
            <van-icon v-else :name="item.icon || 'apps-o'" size="20" color="#666" />
          </div>
          <span class="nav-sm-label">{{ item.title }}</span>
        </div>
      </div>
    </div>

    <!-- Vino产品：来自后台「商品配置-商品管理」选品，深色宫格 4 列 -->
    <div v-if="vinoProductItems.length" class="vino-product-section" :style="vinoProductSectionStyle">
      <div v-if="skinLayerVinoProduct" class="section-skin-layer" :style="skinLayerVinoProduct" aria-hidden="true" />
      <div class="vino-product-inner">
      <div class="vino-product-head">
        <h3>{{ t('home.vinoProducts') }}</h3>
        <span class="vino-more" @click="$router.push('/products')">{{ t('home.viewAll') }}</span>
      </div>
      <div class="vino-product-grid">
        <div
          v-for="item in vinoProductItems"
          :key="item.id"
          class="vino-product-cell"
          @click="openVinoProductGuide(item)"
        >
          <div class="vino-product-icon-wrap">
            <template v-if="vinoUseImg(item)">
              <img
                v-if="!vinoImgFailed[item.id]"
                :src="vinoImgResolved(item)"
                class="vino-product-icon-img"
                alt=""
                @error="onVinoImgError(item.id)"
              />
              <van-icon v-else :name="vinoIconName(item)" size="28" color="rgba(0,0,0,0.45)" />
            </template>
            <van-icon v-else :name="vinoIconName(item)" size="28" color="rgba(0,0,0,0.45)" />
          </div>
          <span class="vino-product-name">{{ item.title }}</span>
        </div>
      </div>
      </div>
    </div>

    <!-- 甄选推荐：展示大图横滑（配置同 Vino，图片来自商品「展示大图」） -->
    <div v-if="featuredRecommendItems.length" class="featured-recommend-section" :style="featuredRecommendSectionStyle">
      <div v-if="skinLayerFeaturedRecommend" class="section-skin-layer" :style="skinLayerFeaturedRecommend" aria-hidden="true" />
      <div class="featured-recommend-inner">
        <div class="featured-recommend-head">
          <h3>{{ t('home.featured') }}</h3>
        </div>
        <div class="featured-recommend-scroll">
          <div
            v-for="item in featuredRecommendItems"
            :key="item.id"
            class="featured-recommend-card"
            @click="openFeaturedRecommendGuide(item)"
          >
            <div class="featured-recommend-card-img-wrap">
              <img
                v-if="featuredCoverSrc(item)"
                :src="featuredCoverSrc(item)"
                class="featured-recommend-img"
                alt=""
                referrerpolicy="no-referrer"
                @error="onFeaturedImgError(item.id)"
              />
              <div v-else class="featured-recommend-placeholder" />
            </div>
            <div class="featured-recommend-card-overlay">
              <div class="featured-recommend-title">{{ item.title }}</div>
              <div v-if="item.subtitle" class="featured-recommend-sub">{{ item.subtitle }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的商品：为空时整栏隐藏 -->
    <div v-if="myProductsDisplay.length" class="section card-section section-my-products" :style="myProductsSectionStyle">
      <div v-if="skinLayerMyProducts" class="section-skin-layer" :style="skinLayerMyProducts" aria-hidden="true" />
      <div class="section-skin-content">
      <div class="section-header">
        <h3>{{ myProductsTitle }}</h3>
        <span class="more" @click="$router.push('/mine/products')">{{ t('home.viewMore') }}</span>
      </div>
      <input ref="qrFileInputRef" type="file" accept="image/*" class="hidden-input" @change="onQrFileChange" />
      <div class="my-products-list">
        <div
          v-for="(item, i) in myProductsDisplay"
          :key="item.productKey || i"
          class="my-product-item"
          :class="{ 'my-product-item--clickable': !!productGuideSlug(item) }"
          @click="onMyProductItemClick(item)"
        >
          <span class="my-product-category">{{ pick(item, 'categoryName') || '-' }}</span>
          <div class="my-product-icon-wrap">
            <img
              v-if="myProductShowImg(item)"
              :src="myProductImgSrc(item)"
              class="my-product-icon"
              alt=""
              referrerpolicy="no-referrer"
              @error="onMyProductImgError(item.productKey)"
            />
            <van-icon v-else :name="myProductVantName(item)" class="my-product-icon-placeholder" />
          </div>
          <span class="my-product-name">{{ item.productName || item.productKey }}</span>
        </div>
      </div>
      </div>
    </div>

    <!-- 探索 VINO：后台单条配置，大图 + 居中标题 + 跳转 -->
    <div v-if="exploreVinoVisible" class="explore-vino-section">
      <div class="explore-vino-inner">
        <div class="explore-vino-head">
          <h3>{{ exploreVinoBarTitle }}</h3>
        </div>
        <div class="explore-vino-card" role="button" tabindex="0" @click="openExploreVinoLink">
          <template v-if="exploreVinoImgSrc">
            <div class="explore-vino-media">
              <img
                :src="exploreVinoImgSrc"
                class="explore-vino-bg-img"
                alt=""
                referrerpolicy="no-referrer"
              />
              <div class="explore-vino-dim" aria-hidden="true" />
              <div class="explore-vino-center explore-vino-center--overlay">
                <div class="explore-vino-main">{{ exploreVinoMainTitle }}</div>
                <div v-if="exploreVinoSubTitle" class="explore-vino-sub">{{ exploreVinoSubTitle }}</div>
                <div class="explore-vino-circle">
                  <van-icon name="arrow" size="16" color="#fff" />
                </div>
              </div>
            </div>
          </template>
          <div v-else class="explore-vino-center explore-vino-center--plain">
            <div class="explore-vino-main-plain">{{ exploreVinoMainTitle }}</div>
            <div v-if="exploreVinoSubTitle" class="explore-vino-sub-plain">{{ exploreVinoSubTitle }}</div>
            <div class="explore-vino-circle explore-vino-circle--plain">
              <van-icon name="arrow" size="16" color="#B91C1C" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-space"></div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, nextTick, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { showToast } from 'vant';
import { homeConfigApi, authApi, guideApi } from '@/api';
import LodImg from '@/components/LodImg.vue';
import PageThemeLayer from '@/components/PageThemeLayer.vue';
import LangSwitcher from '@/components/LangSwitcher.vue';
import { detectLangByIp, t, pick, isEn } from '@/utils/i18n';
import { resolvePublicUrl } from '@/utils/mediaUrl';
import { guideProductMediaUrl, homepageCarouselUrl } from '@/utils/cosMedia.js';
import { buildSectionSkinLayerStyle, buildSectionSkinContainerStyle } from '@/utils/sectionSkin';

const router = useRouter();
const showShare = ref(false);
const qrCanvas = ref(null);
const qrFileInputRef = ref(null);
const shareUrl = window.location.origin;
const allItems = ref([]);
const homepageCarouselIds = ref([]);
/** 与首页 Vino 宫格合并用：商品管理(DeviceGuide) 当前图标，避免仅依赖 home_config 缓存 */
const guidesList = ref([]);
const myProducts = ref([]);
const addProductLoading = ref(false);
const vinoImgFailed = reactive({});
const myProductImgFailed = reactive({});
const featuredImgFailed = reactive({});

const tocMediaOpt = { apiBase: import.meta.env.VITE_API_BASE || '' };
function homepageLang() {
  return isEn.value ? 'en' : 'zh';
}

async function loadHomepageCarouselIds() {
  const lang = homepageLang();
  const r = await fetch('/api/homepage?lang=' + encodeURIComponent(lang), { credentials: 'include', cache: 'no-store' });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  const ids = (j && j.data && j.data.ids) || [];
  homepageCarouselIds.value = Array.isArray(ids) ? ids.map(x => String(x).trim()).filter(Boolean) : [];
}

function guideRuleCover(g) {
  const id = g && Number(g.id);
  if (!Number.isFinite(id) || id <= 0) return { cover: '', thumb: '' };
  const lang = isEn.value ? 'en' : 'zh';
  return {
    cover: guideProductMediaUrl(id, 'cover', { lang, apiBase: tocMediaOpt.apiBase }),
    thumb: guideProductMediaUrl(id, 'cover_thumb', { lang, apiBase: tocMediaOpt.apiBase }),
  };
}
function guideRuleIcon(g) {
  const id = g && Number(g.id);
  if (!Number.isFinite(id) || id <= 0) return '';
  const lang = isEn.value ? 'en' : 'zh';
  return guideProductMediaUrl(id, 'icon', { lang, apiBase: tocMediaOpt.apiBase });
}

function productIconUrl(item) {
  const u = (item && item.iconUrl) || '';
  if (!u) return '';
  return resolvePublicUrl(u);
}

function onMyProductImgError(productKey) {
  if (productKey != null && productKey !== '') myProductImgFailed[productKey] = true;
}

function myProductImgSrc(item) {
  const k = item && item.productKey;
  if (k != null && myProductImgFailed[k]) return '';
  return productIconUrl(item);
}

function myProductShowImg(item) {
  return !!myProductImgSrc(item);
}

function myProductVantName(item) {
  const n = String((item && item.guideIcon) || '').trim();
  if (n && /^[a-z0-9-]+$/i.test(n)) return n;
  return 'photo-o';
}

/** 商品配置 slug（后台 guideSlug），用于跳转 /guide/{slug} */
function productGuideSlug(item) {
  const s = item && item.guideSlug;
  return s != null ? String(s).trim() : '';
}

function onMyProductItemClick(item) {
  const slug = productGuideSlug(item);
  if (!slug) {
    showToast(t('home.noGuide'));
    return;
  }
  router.push('/guide/' + encodeURIComponent(slug));
}
async function loadMyProducts() {
  if (!localStorage.getItem('vino_token')) return;
  try {
    const r = await authApi.myProducts();
    myProducts.value = r.data || [];
  } catch { myProducts.value = []; }
}

onMounted(async () => {
  await detectLangByIp();
  try {
    const [hcRes, gRes] = await Promise.all([
      homeConfigApi.list(),
      guideApi.list().catch(() => ({ data: [] })),
      loadHomepageCarouselIds().catch(() => { homepageCarouselIds.value = []; }),
    ]);
    allItems.value = hcRes.data || [];
    guidesList.value = gRes.data || [];
  } catch {
    try {
      const res = await homeConfigApi.list();
      allItems.value = res.data || [];
    } catch { /* use empty */ }
    guidesList.value = [];
    homepageCarouselIds.value = [];
  }
  await loadMyProducts();
});

watch(isEn, () => {
  void loadHomepageCarouselIds().catch(() => {
    homepageCarouselIds.value = [];
  });
});

function onAddProductClick() {
  if (!localStorage.getItem('vino_token')) {
    router.push('/login?redirect=' + encodeURIComponent('/mine/products'));
    return;
  }
  qrFileInputRef.value?.click();
}

function parseSnAndGuideFromUrl(raw) {
  let sn = '';
  let guide = '';
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, 'http://dummy');
    sn = url.searchParams.get('sn') || '';
    guide = url.searchParams.get('guide') || '';
  } catch {
    const snMatch = raw.match(/[?&]sn=([^&]+)/);
    const guideMatch = raw.match(/[?&]guide=([^&]+)/);
    if (snMatch) sn = decodeURIComponent(snMatch[1].replace(/\+/g, ' '));
    if (guideMatch) guide = decodeURIComponent(guideMatch[1].replace(/\+/g, ' '));
  }
  return { sn: sn.trim(), guide: guide.trim() };
}

async function onQrFileChange(e) {
  const file = e.target?.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!localStorage.getItem('vino_token')) {
    router.push('/login?redirect=' + encodeURIComponent('/mine/products'));
    return;
  }
  addProductLoading.value = true;
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height);
    if (!decoded || !decoded.data) {
      showToast(t('home.qrUnclear'));
      return;
    }
    const { sn, guide } = parseSnAndGuideFromUrl(decoded.data);
    if (!sn) {
      showToast(t('home.qrNoSerial'));
      return;
    }
    const res = await authApi.bindProduct({ sn });
    if (res.code === 0) {
      const guideSlug = (res.data && res.data.guideSlug && String(res.data.guideSlug).trim()) || guide;
      if (guideSlug) {
        router.push('/guide/' + encodeURIComponent(guideSlug));
        return;
      }
      showToast(t('home.bindOk'));
      await loadMyProducts();
    } else {
      showToast(res.message || t('home.bindFailed'));
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || t('home.bindError');
    showToast(msg);
  } finally {
    addProductLoading.value = false;
  }
}

const headerLogoUrl = computed(() => {
  const logo = allItems.value.find(i => i.section === 'headerLogo' && i.status === 'active');
  return logo ? pick(logo, 'imageUrl') : '';
});
const heroBgList = computed(() => {
  const ids = homepageCarouselIds.value || [];
  const lang = homepageLang();
  return ids
    .map(id => ({ url: homepageCarouselUrl(id, lang), thumb: '' }))
    .filter(i => i.url);
});
const heroBgFallback = computed(() => {
  const ids = homepageCarouselIds.value || [];
  const lang = homepageLang();
  return ids.length ? homepageCarouselUrl(ids[0], lang) : '';
});
const navSectionTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'navSectionTitle' && i.status === 'active');
  return (item?.title || '').trim() || t('home.selfBook');
});
const myProductsTitle = computed(() => {
  const item = allItems.value.find(i => i.section === 'myProducts' && i.status === 'active');
  return (item?.title || '').trim() || t('home.myProducts');
});
// 首页板块整体上下偏移量(px)，来自后台首页配置
const homeSectionOffsetPx = computed(() => {
  const item = allItems.value.find(i => i.section === 'homeSectionOffset' && i.status === 'active');
  if (!item || item.title === undefined || item.title === '') return 0;
  const n = parseInt(String(item.title).trim(), 10);
  return Number.isNaN(n) ? 0 : n;
});
const homeSectionOffsetStyle = computed(() =>
  homeSectionOffsetPx.value !== 0 ? { marginTop: homeSectionOffsetPx.value + 'px' } : undefined
);

const navLgItems = computed(() =>
  allItems.value.filter(i => i.section === 'navLg' && i.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(i => ({ id: i.id, title: i.title, icon: i.icon, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb, path: i.path || '/services', color: i.color }))
);
const navSmItems = computed(() =>
  allItems.value.filter(i => i.section === 'navSm' && i.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(i => ({ id: i.id, title: i.title, icon: i.icon, imageUrl: i.imageUrl, imageUrlThumb: i.imageUrlThumb, path: i.path || '/services', color: i.color }))
);
const guidesBySlug = computed(() => {
  const m = Object.create(null);
  for (const g of guidesList.value || []) {
    const s = String(g.slug || '').trim();
    if (!s) continue;
    m[s] = g;
    m[s.toLowerCase()] = g;
  }
  return m;
});

function rowGuide(slug) {
  const s = String(slug || '').trim();
  if (!s) return null;
  const m = guidesBySlug.value;
  return m[s] || m[s.toLowerCase()] || null;
}

/** 与商品管理 /guides 合并后的「我的商品」行（图标 URL、名称、备用 Vant 名） */
const myProductsDisplay = computed(() => {
  return (myProducts.value || []).map((item) => {
    const slug = productGuideSlug(item);
    const g = slug ? rowGuide(slug) : null;
    if (!g) {
      return { ...item };
    }
    const iconUrl = guideRuleIcon(g) || (item.iconUrl || '');
    return {
      ...item,
      iconUrl,
      productName: pick(g, 'name') || (item.productName || item.productKey),
      guideIcon: (g.icon != null ? String(g.icon) : '') || (item.guideIcon || ''),
    };
  });
});

const featuredRecommendItems = computed(() => {
  const rows = allItems.value
    .filter((i) => i.section === 'featuredRecommend' && i.status === 'active')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return rows.map((i) => {
    const path = (i.path || '').trim();
    const g = path ? rowGuide(path) : null;
    if (!g) {
      return {
        id: i.id,
        title: i.title || '',
        subtitle: (i.desc || '').trim(),
        path,
        coverImage: i.imageUrl || '',
        coverThumb: i.imageUrlThumb || '',
      };
    }
    const rc = guideRuleCover(g);
    return {
      id: i.id,
      title: pick(g, 'name') || (i.title || ''),
      subtitle: pick(g, 'subtitle') || ((i.desc || '').trim()),
      path,
      coverImage: rc.cover || (i.imageUrl || ''),
      coverThumb: rc.thumb || (i.imageUrlThumb || ''),
    };
  });
});

function featuredCoverSrc(item) {
  if (!item || featuredImgFailed[item.id]) return '';
  const u = (item.coverImage || item.coverThumb || '').trim();
  return u ? resolvePublicUrl(u) : '';
}

function onFeaturedImgError(id) {
  if (id != null) featuredImgFailed[id] = true;
}

function openFeaturedRecommendGuide(item) {
  const slug = item.path;
  if (!slug) {
    showToast(t('home.noProductLink'));
    return;
  }
  router.push('/guide/' + encodeURIComponent(slug));
}

const vinoProductItems = computed(() => {
  const rows = allItems.value
    .filter((i) => i.section === 'vinoProduct' && i.status === 'active')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return rows.map((i) => {
    const path = (i.path || '').trim();
    const g = path ? rowGuide(path) : null;
    if (!g) {
      return {
        id: i.id,
        title: i.title || '',
        path,
        icon: i.icon || '',
        imageUrl: i.imageUrl || '',
        imageUrlThumb: '',
      };
    }
    const iconUrl = guideRuleIcon(g) || '';
    return {
      id: i.id,
      title: pick(g, 'name') || (i.title || ''),
      path,
      icon: g.icon != null ? String(g.icon) : (i.icon || ''),
      imageUrl: iconUrl || (i.imageUrl || ''),
      imageUrlThumb: '',
    };
  });
});

/** 商品管理里偶发把图片地址写在「图标」文本框 */
function vinoIconFieldLooksLikeUrl(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t) || t.startsWith('//')) return true;
  if (t.startsWith('/') && (t.includes('/uploads/') || t.includes('/static/') || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(t)))
    return true;
  return false;
}

function vinoImgResolved(item) {
  const u = item.imageUrl;
  if (u) return resolvePublicUrl(u);
  const ic = (item.icon || '').trim();
  if (vinoIconFieldLooksLikeUrl(ic)) return resolvePublicUrl(ic);
  return '';
}

function vinoUseImg(item) {
  const u = (item.imageUrl || '').trim();
  if (u) return true;
  return vinoIconFieldLooksLikeUrl(item.icon);
}

function vinoIconName(item) {
  const ic = (item.icon || '').trim();
  if (vinoIconFieldLooksLikeUrl(ic)) return 'photo-o';
  const n = ic;
  if (n && /^[a-z0-9-]+$/i.test(n)) return n;
  return 'photo-o';
}

function onVinoImgError(id) {
  vinoImgFailed[id] = true;
}

const skinLayerHomeScroll = computed(() => buildSectionSkinLayerStyle(allItems.value, 'homeScroll'));
const skinLayerVinoProduct = computed(() => buildSectionSkinLayerStyle(allItems.value, 'vinoProduct'));
const skinLayerFeaturedRecommend = computed(() => buildSectionSkinLayerStyle(allItems.value, 'featuredRecommend'));
const vinoProductSectionStyle = computed(() => buildSectionSkinContainerStyle(allItems.value, 'vinoProduct', 'vino'));
const featuredRecommendSectionStyle = computed(() => buildSectionSkinContainerStyle(allItems.value, 'featuredRecommend', 'fr'));
const skinLayerMyProducts = computed(() => buildSectionSkinLayerStyle(allItems.value, 'myProducts'));
const firstCardSectionStyle = computed(() => buildSectionSkinContainerStyle(allItems.value, 'homeScroll', 'card'));
const myProductsSectionStyle = computed(() => buildSectionSkinContainerStyle(allItems.value, 'myProducts', 'card'));

function openVinoProductGuide(item) {
  const slug = item.path;
  if (!slug) {
    showToast(t('home.noProductLink'));
    return;
  }
  router.push('/guide/' + encodeURIComponent(slug));
}

const exploreVinoRow = computed(() =>
  allItems.value.find((i) => i.section === 'exploreVino' && i.status === 'active') || null
);
const exploreVinoVisible = computed(() => {
  const r = exploreVinoRow.value;
  if (!r) return false;
  const img = (r.imageUrl || '').trim();
  const path = (r.path || '').trim();
  return !!(img || path);
});
const exploreVinoBarTitle = computed(() => {
  const r = exploreVinoRow.value;
  const txt = r ? pick(r, 'title') : '';
  return txt.trim() || t('home.exploreVino');
});
const exploreVinoMainTitle = computed(() => {
  const r = exploreVinoRow.value;
  const txt = r ? pick(r, 'icon') : '';
  return txt.trim() || 'VINO';
});
const exploreVinoSubTitle = computed(() => {
  const r = exploreVinoRow.value;
  return r ? pick(r, 'desc').trim() : '';
});
const exploreVinoImgSrc = computed(() => {
  const r = exploreVinoRow.value;
  if (!r) return '';
  const thumb = pick(r, 'imageUrlThumb');
  const img = pick(r, 'imageUrl');
  const u = (thumb || img || '').trim();
  return u ? resolvePublicUrl(u) : '';
});

function openExploreVinoLink() {
  const raw = (exploreVinoRow.value?.path || '').trim();
  if (!raw) {
    showToast(t('home.noLink'));
    return;
  }
  if (/^https?:\/\//i.test(raw)) {
    window.location.href = raw;
    return;
  }
  const p = raw.startsWith('/') ? raw : '/' + raw;
  router.push(p);
}

watch(showShare, async (val) => {
  if (val) {
    await nextTick();
    if (qrCanvas.value) {
      QRCode.toCanvas(qrCanvas.value, shareUrl, { width: 180, margin: 2, color: { dark: '#1d1d1f', light: '#ffffff' } });
    }
  }
});

const copyUrl = async () => {
  try { await navigator.clipboard.writeText(shareUrl); showToast(t('home.linkCopied')); }
  catch { showToast(t('home.copyFailed')); }
};
</script>

<style scoped>
.home {
  position: relative;
  /* 底部预留 ≥ tabbar 高度 + 安全区，避免内容遮挡底部导航 */
  padding-bottom: 180px;
  background: transparent;
  min-height: 100vh;
}

/* ===== 独立背景层：置于最底层，背景图铺满整区，无蓝色遮挡 ===== */
.home-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 78vh;
  min-height: 480px;
  z-index: 1;
  background: transparent;
}
.home-bg-swipe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
}
.home-bg-swipe .van-swipe-item { height: 100%; }
.home-bg-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* ===== Hero：仅顶部内容区，背景透明以露出 home-bg ===== */
.hero {
  position: relative;
  z-index: 1;
  height: 54vh;
  min-height: 320px;
  max-height: 520px;
  background: transparent;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.02) 40%, transparent 65%, rgba(255,255,255,0.02) 100%);
  display: flex;
  flex-direction: column;
}
.hero-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  padding-top: max(14px, env(safe-area-inset-top));
}
.hero-logo { height: 30px; width: auto; max-width: 100px; object-fit: contain; filter: brightness(0) invert(1); }
.hero-logo-svg { width: 64px; height: 26px; }
.hero-actions { display: flex; gap: 8px; }

/* ===== Card Sections：镜面模糊（毛玻璃）+ 两侧留白 ===== */
.card-section {
  position: relative;
  z-index: 1;
  margin: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.52) 45%,
    rgba(255, 255, 255, 0.38) 100%
  );
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
/* 仅「自助预约」区块上移；我的商品、热门服务等同层级，不设负 margin */
.card-section.first-card {
  margin-top: -32vh;
  min-height: 0;
}
/* 任意连续卡片之间统一留白 */
.card-section + .card-section {
  margin-top: 20px;
}
/* Vino/甄选 非 .card-section，与「我的商品」相邻时需单独顶距 */
.featured-recommend-section + .section-my-products,
.vino-product-section + .section-my-products {
  margin-top: 20px;
}
/* ===== Vino产品：镜面模糊底板 ===== */
.vino-product-section {
  position: relative;
  z-index: 1;
  margin: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.7) 0%,
    rgba(255, 255, 255, 0.48) 50%,
    rgba(255, 255, 255, 0.36) 100%
  );
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  padding: 16px 12px 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.vino-product-inner {
  position: relative;
  z-index: 1;
}

/* ===== 甄选推荐：大图横滑（浅色底，未加载外观图前为白底） ===== */
.featured-recommend-section {
  position: relative;
  z-index: 1;
  margin: 12px;
  border-radius: 16px;
  background: #fff;
  padding: 14px 0 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.featured-recommend-inner {
  position: relative;
  z-index: 1;
}
.featured-recommend-head {
  padding: 0 16px 12px;
}
.featured-recommend-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}
.featured-recommend-scroll {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 12px 6px;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 12px;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  box-sizing: border-box;
}
.featured-recommend-scroll::-webkit-scrollbar {
  display: none;
}
.featured-recommend-card {
  flex: 0 0 auto;
  width: fit-content;
  max-width: min(88vw, 400px);
  scroll-snap-align: center;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: opacity 0.2s;
}
.featured-recommend-card:active {
  opacity: 0.92;
}
.featured-recommend-card-img-wrap {
  display: block;
  width: fit-content;
  max-width: min(88vw, 400px);
  margin: 0 auto;
  background: #f5f5f5;
  border-radius: 16px;
  overflow: hidden;
}
.featured-recommend-img {
  width: auto;
  max-width: min(88vw, 400px);
  height: auto;
  max-height: min(65vh, 520px);
  display: block;
}
.featured-recommend-placeholder {
  width: min(88vw, 400px);
  min-height: 200px;
  background: #f5f5f5;
}
.featured-recommend-card-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  padding: 14px 12px 12px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.12) 40%, transparent 72%);
  pointer-events: none;
}
.featured-recommend-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  line-height: 1.35;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
}
.featured-recommend-sub {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.88);
  margin-top: 6px;
  line-height: 1.4;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.vino-product-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding: 0 4px;
}
.vino-product-head h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}
.vino-more {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  font-weight: 500;
  cursor: pointer;
}
.vino-product-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px 8px;
}
.vino-product-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.vino-product-cell:active {
  opacity: 0.85;
}
.vino-product-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.vino-product-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}
.vino-product-name {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  text-align: center;
  line-height: 1.35;
  max-width: 100%;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ===== 探索 VINO：外层镜面模糊底板 ===== */
.explore-vino-section {
  position: relative;
  z-index: 1;
  margin: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: linear-gradient(
    155deg,
    rgba(255, 255, 255, 0.7) 0%,
    rgba(255, 255, 255, 0.48) 50%,
    rgba(255, 255, 255, 0.36) 100%
  );
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  padding: 14px 12px 18px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5);
}
.explore-vino-inner {
  position: relative;
  z-index: 1;
}
.explore-vino-head {
  margin-bottom: 12px;
  padding: 0 4px;
}
.explore-vino-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.02em;
}
.explore-vino-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  transition: opacity 0.2s;
}
.explore-vino-card:active {
  opacity: 0.94;
}
/* 图片按宽度 100% 展示，高度随原图比例自适应 */
.explore-vino-media {
  position: relative;
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
}
.explore-vino-bg-img {
  width: 100%;
  height: auto;
  display: block;
  vertical-align: top;
}
.explore-vino-dim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.45) 50%, rgba(0, 0, 0, 0.5) 100%);
  pointer-events: none;
}
.explore-vino-center {
  position: relative;
  z-index: 1;
  padding: 36px 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}
.explore-vino-center--overlay {
  position: absolute;
  inset: 0;
  min-height: 0;
}
.explore-vino-main {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.12em;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.explore-vino-sub {
  margin-top: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  letter-spacing: 0.35em;
  line-height: 1.6;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
}
.explore-vino-circle {
  margin-top: 22px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
}
.explore-vino-center--plain {
  min-height: 180px;
  background: #fff;
}
.explore-vino-main-plain {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0.1em;
}
.explore-vino-sub-plain {
  margin-top: 10px;
  font-size: 13px;
  color: #666;
  letter-spacing: 0.2em;
  line-height: 1.6;
}
.explore-vino-circle--plain {
  border-color: rgba(185, 28, 28, 0.5);
  background: rgba(185, 28, 28, 0.06);
}

/* ===== Section common ===== */
.section { padding: 20px; animation: fadeInUp 0.4s var(--vino-transition) both; }
.section:nth-child(3) { animation-delay: 0.05s; }
.section:nth-child(4) { animation-delay: 0.1s; }
.section:nth-child(5) { animation-delay: 0.15s; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h3 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--vino-dark); }
.more { font-size: 14px; color: var(--vino-primary); font-weight: 500; cursor: pointer; }

/* ===== 自助预约 - 大图标 ===== */
.nav-lg-row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 12px;
}
.nav-lg-row::-webkit-scrollbar { display: none; }
.nav-lg-item {
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}
.nav-lg-item:active { transform: scale(0.95); }
.nav-lg-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
}
.nav-lg-img { width: 100%; height: 100%; object-fit: cover; }
.nav-lg-label { font-size: 13px; font-weight: 600; text-align: center; }

/* ===== 自助预约 - 小图标 ===== */
.nav-sm-row {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-top: 4px;
  border-top: 1px solid rgba(0,0,0,0.04);
}
.nav-sm-row::-webkit-scrollbar { display: none; }
.nav-sm-item {
  flex: 1;
  min-width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  cursor: pointer;
  transition: transform 0.2s;
}
.nav-sm-item:active { transform: scale(0.92); }
.nav-sm-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}
.nav-sm-img { width: 100%; height: 100%; object-fit: contain; }
.nav-sm-label { font-size: 11px; color: #666; text-align: center; }

/* ===== 我的商品 ===== */
.my-products-empty { padding: 16px; text-align: center; color: #999; font-size: 14px; }
.hidden-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.my-products-list { display: flex; flex-direction: column; gap: 10px; }
.my-product-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; background: #f8f8f8; border-radius: 10px;
}
.my-product-item--clickable { cursor: pointer; transition: opacity 0.2s; }
.my-product-item--clickable:active { opacity: 0.85; }
.my-product-category { font-size: 13px; color: #666; min-width: 48px; flex-shrink: 0; }
.my-product-icon-wrap { width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; overflow: hidden; background: #eee; display: flex; align-items: center; justify-content: center; }
.my-product-icon { width: 100%; height: 100%; object-fit: contain; }
.my-product-icon-placeholder { font-size: 22px; color: #bbb; }
.my-product-name { flex: 1; font-size: 15px; font-weight: 600; color: var(--vino-dark); min-width: 0; }
.my-product-key { font-size: 12px; color: #999; font-family: monospace; flex-shrink: 0; }

/* 首页配置管理区域包装器，仅此区域受后台「板块整体偏移」影响 */
.home-config-wrap {
  position: relative;
  z-index: 1;
}
.home-config-inner {
  position: relative;
  z-index: 1;
}
.section-skin-layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  overflow: hidden;
}
.section-my-products {
  position: relative;
}
.section-skin-content {
  position: relative;
  z-index: 1;
}

/* 底部留白，避免内容被底部导航遮挡（tabbar 高度 + 安全区，与 .home padding-bottom 配合） */
.footer-space {
  height: calc(140px + env(safe-area-inset-bottom, 0px));
  min-height: 140px;
  flex-shrink: 0;
}

/* ===== Share ===== */
.share-btn { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; transition: all 0.25s; }
.share-btn:active { background: rgba(255,255,255,0.3); transform: scale(0.92); }
.share-popup { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 24px; }
.share-card { background: #fff; border-radius: 20px; padding: 28px 24px; width: 290px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 24px 80px rgba(0,0,0,0.35); }
.share-card-header { width: 160px; height: 50px; background: #000; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; padding: 8px 16px; }
.share-qr { padding: 14px; background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; margin-bottom: 18px; }
.share-qr canvas { display: block; }
.share-hint { font-size: 15px; color: var(--vino-dark); font-weight: 600; margin-bottom: 6px; }
.share-url { font-size: 12px; color: var(--vino-text-secondary); margin-bottom: 16px; word-break: break-all; text-align: center; }
.share-copy-btn { width: 130px; }
.share-close { margin-top: 24px; cursor: pointer; }
</style>
