<template>
  <div v-if="layerStyle" class="page-theme-layer" :style="layerStyle" aria-hidden="true" />
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { homeConfigApi } from '@/api';
import { buildPageThemeLayerStyle } from '@/utils/pageTheme';

const props = defineProps({
  path: { type: String, required: true },
  /** 若传入（如首页已拉取 home-config），则不再请求 */
  items: { type: Array, default: null },
});

const localItems = ref([]);

async function load() {
  if (props.items && Array.isArray(props.items)) {
    localItems.value = props.items;
    return;
  }
  try {
    const res = await homeConfigApi.list();
    localItems.value = res.data || [];
  } catch {
    localItems.value = [];
  }
}

onMounted(load);
watch(
  () => props.items,
  (v) => {
    if (v && Array.isArray(v)) localItems.value = v;
  },
  { deep: true }
);

const layerStyle = computed(() => buildPageThemeLayerStyle(localItems.value, props.path));
</script>

<style scoped>
.page-theme-layer {
  box-sizing: border-box;
}
</style>
