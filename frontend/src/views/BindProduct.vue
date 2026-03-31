<template>
  <div class="bind-product-page">
    <van-nav-bar :title="t('bindProduct.title')" left-arrow @click-left="$router.replace('/')" />
    <div class="bind-content">
      <van-loading v-if="loading" size="24" vertical>{{ t('bindProduct.processing') }}</van-loading>
      <template v-else-if="result === 'success'">
        <van-icon name="success" size="64" color="#07c160" />
        <h3>{{ t('bindProduct.successTitle') }}</h3>
        <p v-if="productName">{{ productName }}</p>
        <p class="sn">{{ t('bindProduct.serialLabel') }}{{ sn }}</p>
        <van-button type="primary" color="#B91C1C" block round class="btn-home" @click="$router.replace('/')">{{ t('bindProduct.backHome') }}</van-button>
      </template>
      <template v-else-if="result === 'error'">
        <van-icon name="cross" size="64" color="#ee0a24" />
        <h3>{{ errorTitle }}</h3>
        <p class="err-msg">{{ errorMsg }}</p>
        <van-button type="primary" color="#B91C1C" block round class="btn-home" @click="$router.replace('/')">{{ t('bindProduct.backHome') }}</van-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi } from '@/api';
import { showToast } from 'vant';
import { t } from '@/utils/i18n';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const result = ref(null);
const productName = ref('');
const errorMsg = ref('');

const sn = computed(() => route.query.sn || '');
const errorTitle = computed(() =>
  (errorMsg.value && errorMsg.value.indexOf('其他账号') !== -1) ? t('bindProduct.errorTaken') : t('bindProduct.errorFailed')
);

onMounted(async () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    const redirect = '/bind-product' + (route.fullPath.includes('?') ? route.fullPath.slice(route.fullPath.indexOf('?')) : '');
    router.replace('/login?redirect=' + encodeURIComponent(redirect));
    return;
  }
  if (!sn.value) {
    result.value = 'error';
    errorMsg.value = '缺少序列号参数';
    loading.value = false;
    return;
  }
  try {
    const res = await authApi.bindProduct({ sn: sn.value });
    if (res.code === 0) {
      const guideSlug = (res.data && res.data.guideSlug && String(res.data.guideSlug).trim()) || (route.query.guide && String(route.query.guide).trim());
      if (guideSlug) {
        router.replace('/guide/' + encodeURIComponent(guideSlug));
        return;
      }
      result.value = 'success';
      productName.value = res.data?.productName || '';
    } else {
      result.value = 'error';
      errorMsg.value = res.message || t('bindProduct.errorFailed');
    }
  } catch (err) {
    result.value = 'error';
    const msg = err?.response?.data?.message || err?.message || t('bindProduct.errorFailed');
    errorMsg.value = msg;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.bind-product-page {
  min-height: 100vh;
  background: var(--vino-bg, #f7f7f7);
}
.bind-content {
  padding: 48px 24px;
  text-align: center;
}
.bind-content h3 {
  margin: 16px 0 8px;
  font-size: 20px;
  color: #333;
}
.bind-content p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}
.bind-content .sn {
  font-family: monospace;
  font-size: 13px;
  color: #999;
}
.bind-content .err-msg {
  color: #ee0a24;
  margin-bottom: 16px;
}
.btn-home {
  margin-top: 32px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}
</style>
