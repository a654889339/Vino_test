<template>
  <div class="address-edit-page">
    <van-nav-bar :title="isEdit ? t('addressEdit.titleEdit') : t('addressEdit.titleNew')" left-arrow @click-left="$router.back()" />

    <van-loading v-if="pageLoading" class="page-loading" size="30" vertical>{{ t('common.loading') }}</van-loading>

    <div v-else class="form-wrap">
      <van-cell-group inset>
        <van-field v-model="form.contactName" :label="t('addressEdit.contact')" :placeholder="t('addressEdit.contactPh')" />
        <van-field v-model="form.contactPhone" :label="t('addressEdit.phone')" type="tel" :placeholder="t('addressEdit.phonePh')" />
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <div class="picker-trigger" @click="showCountryList = !showCountryList; showAreaPicker = false">
          <span class="picker-label">{{ t('addressEdit.country') }}</span>
          <span :class="['picker-value', { placeholder: !form.country }]">
            {{ countryDisplay || t('addressEdit.countryPh') }}
          </span>
          <van-icon :name="showCountryList ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
        </div>
        <div v-if="showCountryList" class="select-list">
          <div
            v-for="c in countryColumns"
            :key="c"
            class="select-item"
            :class="{ active: form.country === c }"
            @click="selectCountry(c)"
          >
            <span>{{ c }}</span>
            <van-icon v-if="form.country === c" name="success" color="#B91C1C" size="16" />
          </div>
        </div>

        <van-field
          v-if="form.country === t('country.other')"
          v-model="form.customCountry"
          :label="t('addressEdit.customCountry')"
          :placeholder="t('addressEdit.customCountryPh')"
        />

        <template v-if="form.country === t('country.cn')">
          <div class="picker-trigger" @click="showAreaPicker = !showAreaPicker; showCountryList = false">
            <span class="picker-label">{{ t('addressEdit.area') }}</span>
            <span :class="['picker-value', { placeholder: !form.province }]">
              {{ areaDisplay || t('addressEdit.areaPh') }}
            </span>
            <van-icon :name="showAreaPicker ? 'arrow-up' : 'arrow-down'" class="picker-arrow" />
          </div>
          <div v-if="showAreaPicker" class="area-picker-wrap" @touchmove.stop @mousewheel.stop>
            <van-area
              :area-list="areaList"
              @confirm="onAreaConfirm"
              @cancel="showAreaPicker = false"
            />
          </div>
        </template>
      </van-cell-group>

      <van-cell-group inset class="mt12">
        <van-field v-model="form.detailAddress" :label="t('addressEdit.detail')" type="textarea" rows="2" :placeholder="t('addressEdit.detailPh')" />
      </van-cell-group>

      <div class="default-switch">
        <span>{{ t('addressEdit.setDefault') }}</span>
        <van-switch v-model="form.isDefault" size="20" active-color="#B91C1C" />
      </div>

      <div class="save-btn-wrap">
        <van-button type="primary" color="#B91C1C" block round :loading="saving" :disabled="!isEdit && createAddressDisabled" @click="onSave">
          {{ t('addressEdit.save') }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { addressApi } from '@/api';
import { showToast } from 'vant';
import { areaList } from '@vant/area-data';
import { t } from '@/utils/i18n';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const pageLoading = ref(false);
const saving = ref(false);
const showCountryList = ref(false);
const showAreaPicker = ref(false);

const injectedStatus = inject('appStatus', null);
const createAddressDisabled = computed(() => {
  const s = injectedStatus && injectedStatus.value ? injectedStatus.value : null;
  if (!s) return false;
  return s.enableCreateAddress === false;
});
const createAddressDisabledText = computed(() => t('当前已关闭创建地址功能，请稍后再试。', 'Address creation is currently disabled. Please try again later.'));

const countryColumns = computed(() => [
  t('country.cn'), t('country.hk'), t('country.mo'), t('country.tw'),
  t('country.us'), t('country.uk'), t('country.jp'), t('country.kr'), t('country.sg'), t('country.au'),
  t('country.ca'), t('country.de'), t('country.fr'), t('country.my'), t('country.th'), t('country.other'),
]);

const form = reactive({
  contactName: '',
  contactPhone: '',
  country: '',
  customCountry: '',
  province: '',
  city: '',
  district: '',
  detailAddress: '',
  isDefault: false,
});

const countryDisplay = computed(() => {
  if (form.country === t('country.other') && form.customCountry) return `${t('country.other')} - ${form.customCountry}`;
  return form.country || '';
});

const areaDisplay = computed(() => {
  if (form.province) return `${form.province} ${form.city} ${form.district}`.trim();
  return '';
});

const selectCountry = (c) => {
  form.country = c;
  form.province = '';
  form.city = '';
  form.district = '';
  form.customCountry = '';
  showCountryList.value = false;
};

const onAreaConfirm = ({ selectedOptions }) => {
  form.province = selectedOptions[0]?.text || '';
  form.city = selectedOptions[1]?.text || '';
  form.district = selectedOptions[2]?.text || '';
  showAreaPicker.value = false;
};

const onSave = async () => {
  if (!isEdit.value && createAddressDisabled.value) { showToast(createAddressDisabledText.value); return; }
  if (!form.contactName.trim()) { showToast(t('addressEdit.contactPh')); return; }
  if (!form.contactPhone.trim()) { showToast(t('addressEdit.phonePh')); return; }
  if (!form.country) { showToast(t('addressEdit.countryPh')); return; }
  if (form.country === t('country.other') && !form.customCountry.trim()) { showToast(t('addressEdit.customCountryPh')); return; }
  if (form.country === t('country.cn') && !form.province) { showToast(t('addressEdit.areaPh')); return; }
  if (!form.detailAddress.trim()) { showToast(t('addressEdit.detailPh')); return; }

  saving.value = true;
  try {
    if (isEdit.value) {
      await addressApi.update(route.params.id, { ...form });
    } else {
      await addressApi.create({ ...form });
    }
    showToast(t('addressEdit.saveOk'));
    router.back();
  } catch (err) {
    showToast(err.message || t('addressEdit.saveFailed'));
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  if (isEdit.value) {
    pageLoading.value = true;
    try {
      const res = await addressApi.list();
      const addr = res.data.find(a => a.id === Number(route.params.id));
      if (addr) {
        Object.assign(form, {
          contactName: addr.contactName,
          contactPhone: addr.contactPhone,
          country: addr.country,
          customCountry: addr.customCountry,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          detailAddress: addr.detailAddress,
          isDefault: addr.isDefault,
        });
      }
    } catch (err) {
      showToast(t('common.loadFailed'));
    } finally {
      pageLoading.value = false;
    }
  }
});
</script>

<style scoped>
.address-edit-page {
  background: var(--vino-bg, #f7f7f7);
  min-height: 100vh;
}
.page-loading { padding-top: 100px; text-align: center; }
.form-wrap { padding-bottom: 100px; }
.mt12 { margin-top: 12px; }

.picker-trigger {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  min-height: 44px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.picker-label {
  font-size: 14px;
  color: #323233;
  width: 6.2em;
  flex-shrink: 0;
  margin-right: 12px;
}
.picker-value {
  flex: 1;
  font-size: 14px;
  color: #323233;
  text-align: right;
}
.picker-value.placeholder { color: #c8c9cc; }
.picker-arrow { margin-left: 4px; color: #969799; flex-shrink: 0; }

.select-list {
  max-height: 200px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid #f0f0f0;
}
.select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 14px;
  color: #323233;
  border-bottom: 1px solid #fafafa;
  cursor: pointer;
}
.select-item:active { background: #f5f5f5; }
.select-item.active { color: #B91C1C; font-weight: 500; }

.area-picker-wrap {
  border-bottom: 1px solid #f0f0f0;
  height: 260px;
  overflow: hidden;
}

.default-switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  margin: 12px 16px;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
}

.save-btn-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  margin: 0 auto;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}
</style>
