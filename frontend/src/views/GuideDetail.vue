<template>
  <div class="guide-detail-page">
    <van-nav-bar :title="guide.name || '设备指南'" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" size="36" style="text-align:center;padding:60px 0" />

    <template v-else-if="guide.id">
      <!-- Hero + Media -->
      <div class="hero-block">
        <div class="hero-section">
          <div v-if="guide.showcaseVideo" class="hero-video-wrap" @click="playVideo(fullUrl(guide.showcaseVideo))">
            <img v-if="guide.coverImage" :src="fullUrl(guide.coverImage)" class="hero-img" />
            <div v-else class="hero-placeholder" :style="{ background: guide.gradient }">
              <img v-if="guide.iconUrl" :src="guide.iconUrl" style="width:64px;height:64px;object-fit:contain" />
              <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            </div>
            <div class="hero-play-btn"><van-icon name="play-circle" size="48" color="#fff" /></div>
          </div>
          <div v-else-if="guide.coverImage" class="hero-img-wrap" @click="previewImage(fullUrl(guide.coverImage))">
            <img :src="fullUrl(guide.coverImage)" class="hero-img" />
          </div>
          <div v-else class="hero-gradient" :style="{ background: guide.gradient }">
            <img v-if="guide.iconUrl" :src="guide.iconUrl" style="width:64px;height:64px;object-fit:contain" />
            <van-icon v-else :name="guide.icon" size="64" color="#fff" />
            <h2>{{ guide.name }}</h2>
          </div>
        </div>
        <div v-if="mediaItems.length" class="hero-media">
          <h3 class="hero-media-title">{{ mediaItems[0]?.title || guide.name }}</h3>
          <div class="media-scroll">
            <div v-for="(m, i) in mediaItems" :key="i" class="media-card" @click="openMedia(m)">
              <div class="media-thumb">
                <img v-if="getThumbUrl(m)" :src="getThumbUrl(m)" />
                <div v-else class="media-thumb-placeholder"><van-icon :name="isVideo(m) ? 'video-o' : 'photo-o'" size="28" color="#999" /></div>
                <div v-if="isVideo(m)" class="media-play"><van-icon name="play-circle-o" size="24" color="#fff" /></div>
                <div class="media-label-overlay">{{ m.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Help Links -->
      <div v-if="helpItems.length || sections.length" class="section-card">
        <h3 class="section-title">使用帮助</h3>
        <van-cell-group inset :border="false">
          <van-cell v-if="helpItems.length" title="电子说明书" icon="description" is-link @click="$router.push(`/guide/${guide.id}/manual`)" />
          <van-cell v-if="sections.length" title="常见问题与保养建议" icon="info-o" is-link @click="$router.push(`/guide/${guide.id}/maintenance`)" />
        </van-cell-group>
      </div>

      <!-- Service Entry -->
      <div class="section-card">
        <h3 class="section-title">服务入口</h3>
        <div class="service-entry-grid">
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#EDE9FE"><van-icon name="service-o" size="24" color="#7C3AED" /></div>
            <span>自助服务</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#DBEAFE"><van-icon name="location-o" size="24" color="#2563EB" /></div>
            <span>服务网点</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#D1FAE5"><van-icon name="shield-o" size="24" color="#059669" /></div>
            <span>售后政策</span>
          </div>
          <div class="entry-item" @click="$router.push('/services')">
            <div class="entry-icon" style="background:#FEF3C7"><van-icon name="balance-list-o" size="24" color="#D97706" /></div>
            <span>维修报价</span>
          </div>
        </div>
      </div>

      <div style="height:20px"></div>
    </template>

    <!-- Video Player Overlay -->
    <div v-if="playShowcase" class="video-backdrop" @click.self="closeVideo()">
      <div class="video-overlay">
        <video v-if="currentVideoUrl" :src="currentVideoUrl" controls autoplay playsinline class="overlay-video" />
        <div class="video-close" @click="closeVideo()"><van-icon name="cross" size="24" color="#fff" /></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { showImagePreview } from 'vant';
import { guideApi } from '@/api';

const route = useRoute();
const loading = ref(true);
const guide = ref({});
const playShowcase = ref(false);
const currentVideoUrl = ref('');

const sections = computed(() => {
  const s = guide.value.sections;
  return Array.isArray(s) ? s : [];
});
const mediaItems = computed(() => {
  const m = guide.value.mediaItems;
  return Array.isArray(m) ? m : [];
});
const helpItems = computed(() => {
  const h = guide.value.helpItems;
  return Array.isArray(h) ? h : [];
});

const BASE = import.meta.env.VITE_API_BASE || '';
const fullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE.replace('/api', '') + url;
};

const VIDEO_EXTS = /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i;
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i;

const isVideoUrl = (url) => url && VIDEO_EXTS.test(url);
const isImageUrl = (url) => url && IMAGE_EXTS.test(url);

const isVideo = (m) => {
  if (m.url && isVideoUrl(m.url)) return true;
  if (m.thumb && isVideoUrl(m.thumb)) return true;
  return m.type === 'video' && !isImageUrl(m.url || m.thumb || '');
};

const getMediaUrl = (m) => {
  if (m.url) return fullUrl(m.url);
  if (m.thumb) return fullUrl(m.thumb);
  return '';
};

const getThumbUrl = (m) => {
  if (m.thumb && isImageUrl(m.thumb)) return fullUrl(m.thumb);
  if (m.url && isImageUrl(m.url)) return fullUrl(m.url);
  if (m.thumb && !isVideoUrl(m.thumb)) return fullUrl(m.thumb);
  return '';
};

const playVideo = (url) => {
  currentVideoUrl.value = url;
  playShowcase.value = true;
};

const closeVideo = () => {
  playShowcase.value = false;
  currentVideoUrl.value = '';
};

const previewImage = (url) => {
  showImagePreview({ images: [url], closeable: true });
};

const openMedia = (m) => {
  const url = getMediaUrl(m);
  if (!url) return;
  if (isVideo(m)) {
    playVideo(url);
  } else {
    const images = mediaItems.value
      .filter(item => !isVideo(item) && getMediaUrl(item))
      .map(item => getMediaUrl(item));
    const idx = images.indexOf(url);
    showImagePreview({ images, startPosition: idx >= 0 ? idx : 0, closeable: true });
  }
};

onMounted(async () => {
  try {
    const res = await guideApi.detail(route.params.id);
    guide.value = res.data || {};
  } catch { /* fallback empty */ }
  loading.value = false;
});
</script>

<style scoped>
.guide-detail-page { background: #f5f5f5; min-height: 100vh; }

.hero-block { background: #fff; margin-bottom: 10px; }
.hero-section { position: relative; }
.hero-video-wrap, .hero-img-wrap { position: relative; cursor: pointer; }
.hero-img { width: 100%; height: 240px; object-fit: cover; display: block; }
.hero-play-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 56px; height: 56px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.hero-gradient { height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #fff; }
.hero-gradient h2 { font-size: 22px; font-weight: 600; }
.hero-placeholder { width: 100%; height: 240px; display: flex; align-items: center; justify-content: center; }

.hero-media { padding: 16px; }
.hero-media-title { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; }

.section-card { background: #fff; margin: 10px 12px; border-radius: 12px; padding: 16px; }
.section-title { font-size: 16px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px; display: flex; align-items: center; }

.media-scroll { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.media-scroll::-webkit-scrollbar { display: none; }
.media-card { flex-shrink: 0; width: 130px; cursor: pointer; }
.media-thumb { width: 130px; height: 160px; border-radius: 10px; overflow: hidden; position: relative; background: #1a1a1a; }
.media-thumb img { width: 100%; height: 100%; object-fit: cover; }
.media-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #2a2a2a; }
.media-play { position: absolute; top: 40%; left: 50%; transform: translate(-50%,-50%); width: 36px; height: 36px; background: rgba(0,0,0,0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.media-label-overlay {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 20px 8px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  font-size: 13px; font-weight: 600; color: #fff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}


.service-entry-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.entry-item { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
.entry-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.entry-item span { font-size: 12px; color: #666; }

.video-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 200; display: flex; align-items: center; justify-content: center; }
.video-overlay { position: relative; width: 90vw; max-width: 480px; }
.overlay-video { width: 100%; border-radius: 12px; background: #000; max-height: 70vh; display: block; }
.video-close { position: absolute; top: -40px; right: 0; width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
</style>
