<template>
  <div class="checkout-page">
    <van-nav-bar title="确认订单" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>{{ t('common.loading') }}</van-loading>

    <template v-else>
      <template v-if="!lines.length">
        <van-empty description="购物车为空">
          <van-button type="primary" round block class="back-btn" @click="$router.push('/products')">
            去选购
          </van-button>
        </van-empty>
      </template>

      <template v-else>
        <van-cell-group inset>
          <van-cell title="联系人">
            <template #value>
              <input v-model.trim="form.contactName" class="inline-input" placeholder="请输入姓名" />
            </template>
          </van-cell>
          <van-cell title="手机号">
            <template #value>
              <input v-model.trim="form.contactPhone" class="inline-input" placeholder="请输入手机号" />
            </template>
          </van-cell>
          <van-cell title="地址">
            <template #value>
              <textarea v-model.trim="form.address" class="inline-textarea" placeholder="请输入详细地址" />
            </template>
          </van-cell>
          <van-cell title="备注">
            <template #value>
              <input v-model.trim="form.remark" class="inline-input" placeholder="可选" />
            </template>
          </van-cell>
        </van-cell-group>

        <van-cell-group inset class="mt12">
          <van-cell title="商品明细" />
          <van-cell v-for="row in lines" :key="row.guideId" :title="row.name">
            <template #label>
              <span class="meta">{{ row.qty }} 件 · {{ formatPriceDisplay(row.listPrice, row.currency) }}</span>
            </template>
            <template #value>
              <span class="line-total">{{ formatPriceDisplay(row.lineTotal, row.currency) }}</span>
            </template>
          </van-cell>
        </van-cell-group>

        <div class="app-fixed-bottom-shell">
          <div class="checkout-bottom">
            <div class="total">
              合计 <strong>{{ formatPriceDisplay(totalPrice, currencyHint) || '—' }}</strong>
            </div>
            <van-button
              type="primary"
              color="#B91C1C"
              block
              round
              :loading="submitting"
              @click="submit"
            >
              提交订单
            </van-button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { cartApi, goodsOrderApi } from '@/api';
import { formatPriceDisplay } from '@/utils/currency';
import { t } from '@/utils/i18n';

const router = useRouter();
const loading = ref(true);
const submitting = ref(false);

const lines = ref([]);
const totalPrice = ref(0);

const currencyHint = computed(() => {
  const first = (lines.value || []).find((x) => x && x.currency);
  return first ? first.currency : null;
});

const form = reactive({
  contactName: '',
  contactPhone: '',
  address: '',
  remark: '',
});

async function load() {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    loading.value = false;
    showToast('请先登录');
    router.replace('/login');
    return;
  }
  try {
    const res = await cartApi.get();
    const d = res.data || {};
    lines.value = Array.isArray(d.items) ? d.items : [];
    totalPrice.value = d.totalPrice || 0;
  } catch {
    lines.value = [];
    totalPrice.value = 0;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!lines.value.length) {
    showToast('购物车为空');
    return;
  }
  if (!form.contactName.trim() || !form.contactPhone.trim()) {
    showToast('请填写联系人和手机号');
    return;
  }
  if (!form.address.trim()) {
    showToast('请填写地址');
    return;
  }
  submitting.value = true;
  try {
    await goodsOrderApi.checkout({
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      address: form.address,
      remark: form.remark,
    });
    showToast('下单成功');
    router.replace('/goods-orders');
  } catch (e) {
    showToast(e?.message || '下单失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.checkout-page {
  min-height: 100vh;
  background: var(--vino-bg, #f6f6f8);
  padding-bottom: 120px;
  box-sizing: border-box;
}

.page-loading {
  padding: 80px 0;
}

.mt12 {
  margin-top: 12px;
}

.inline-input {
  width: 100%;
  border: none;
  outline: none;
  text-align: right;
  background: transparent;
  color: #111827;
}

.inline-textarea {
  width: 100%;
  min-height: 60px;
  border: none;
  outline: none;
  resize: none;
  text-align: right;
  background: transparent;
  color: #111827;
}

.meta {
  font-size: 12px;
  color: #6b7280;
}

.line-total {
  color: #b91c1c;
  font-weight: 700;
}

.checkout-bottom {
  padding: 12px 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  background: linear-gradient(to top, rgba(255, 255, 255, 0.98), rgba(248, 248, 250, 0.96));
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}

.total {
  font-size: 15px;
  margin-bottom: 10px;
  color: #111827;
}

.total strong {
  color: #b91c1c;
  font-size: 20px;
}

.back-btn {
  margin-top: 16px;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}
</style>

