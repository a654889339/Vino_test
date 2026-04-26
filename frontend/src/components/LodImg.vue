<template>
  <img
    v-if="src"
    :src="displaySrc"
    :alt="alt"
    :class="imgClass"
    :style="imgStyle"
    loading="lazy"
    @load="onLoad"
    @error="onError"
  />
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import { getBlobUrlForDisplay, revokeIfCachedBlob } from '@/utils/cosMedia.js';

const API_OPT = { apiBase: import.meta.env.VITE_API_BASE || '' };

const props = defineProps({
  src: { type: String, default: '' },
  thumb: { type: String, default: '' },
  alt: { type: String, default: '' },
  imgClass: { type: String, default: '' },
  imgStyle: { type: [String, Object], default: undefined },
});

const displaySrc = ref('');
const loadGen = ref(0);
const showingThumb = ref(false);
/** 当前 <img> 的 blob: 或用于 revoke 的 URL，便于卸载时与失败回退时释放 */
let currentObjectUrl = '';

function releaseCurrentBlob() {
  if (currentObjectUrl && currentObjectUrl.startsWith('blob:')) {
    revokeIfCachedBlob(currentObjectUrl);
  }
  currentObjectUrl = '';
}

async function urlForRender(raw) {
  if (!raw) return '';
  return getBlobUrlForDisplay(raw, API_OPT);
}

async function applyFromProps() {
  const g = ++loadGen.value;
  const thumb = (props.thumb && String(props.thumb).trim()) ? String(props.thumb) : '';
  const src = (props.src && String(props.src).trim()) ? String(props.src) : '';
  if (!thumb && !src) {
    displaySrc.value = '';
    showingThumb.value = false;
    return;
  }
  if (thumb && src) {
    const u = await urlForRender(thumb);
    if (g !== loadGen.value) return;
    releaseCurrentBlob();
    if (u.startsWith('blob:')) currentObjectUrl = u;
    displaySrc.value = u;
    showingThumb.value = true;
    return;
  }
  showingThumb.value = false;
  const u = await urlForRender(src);
  if (g !== loadGen.value) return;
  releaseCurrentBlob();
  if (u.startsWith('blob:')) currentObjectUrl = u;
  displaySrc.value = u;
}

async function loadFull() {
  if (!props.src) return;
  const g = loadGen.value;
  const u = await urlForRender(props.src);
  if (g !== loadGen.value) return;
  releaseCurrentBlob();
  if (u.startsWith('blob:')) currentObjectUrl = u;
  showingThumb.value = false;
  displaySrc.value = u;
}

function onLoad() {
  if (showingThumb.value && props.src) {
    void loadFull();
  }
}

function onError() {
  if (showingThumb.value && props.src) {
    void loadFull();
    return;
  }
  if (props.src) {
    void (async () => {
      const g = loadGen.value;
      const u = await urlForRender(props.src);
      if (g !== loadGen.value) return;
      releaseCurrentBlob();
      if (u.startsWith('blob:')) currentObjectUrl = u;
      displaySrc.value = u;
    })();
  }
}

watch(
  () => [props.src, props.thumb],
  () => {
    void applyFromProps();
  },
  { immediate: true }
);

onUnmounted(() => {
  loadGen.value += 1;
  releaseCurrentBlob();
  displaySrc.value = '';
});
</script>
