<template>
  <div class="detail-page">
    <van-nav-bar title="服务详情" left-arrow @click-left="$router.back()" />

    <van-loading v-if="loading" class="page-loading" size="36" vertical>加载中...</van-loading>

    <template v-else>
      <div class="detail-cover" :style="{ background: coverBg }">
        <van-icon :name="serviceIcon" size="60" color="#fff" />
      </div>

      <div class="detail-body">
        <h2>{{ serviceData.title }}</h2>
        <p class="detail-desc">{{ serviceData.description }}</p>

        <div class="price-row">
          <span class="detail-price">¥{{ serviceData.price }}</span>
          <span class="origin-price" v-if="serviceData.originPrice">¥{{ serviceData.originPrice }}</span>
          <van-tag type="primary" color="#B91C1C">限时优惠</van-tag>
        </div>

        <van-divider />

        <h3>服务亮点</h3>
        <div class="features">
          <div class="feature-item" v-for="f in features" :key="f.title">
            <van-icon :name="f.icon" size="20" color="#B91C1C" />
            <div>
              <h4>{{ f.title }}</h4>
              <p>{{ f.desc }}</p>
            </div>
          </div>
        </div>

        <van-divider />

        <h3>服务流程</h3>
        <van-steps direction="vertical" :active="0" active-color="#B91C1C">
          <van-step>在线下单</van-step>
          <van-step>工程师接单</van-step>
          <van-step>上门服务</van-step>
          <van-step>验收确认</van-step>
          <van-step>完成评价</van-step>
        </van-steps>
      </div>

      <div class="detail-footer">
        <van-button icon="chat-o" type="default" size="small">咨询</van-button>
        <van-button type="primary" color="#B91C1C" block round @click="onBookClick">
          立即预约
        </van-button>
      </div>

      <!-- 下单弹窗 -->
      <van-popup v-model:show="showOrderPopup" position="bottom" round :style="{ maxHeight: '85%' }">
        <div class="order-popup">
          <h3>预约服务</h3>
          <div class="order-service-info">
            <div class="order-service-icon" :style="{ background: coverBg }">
              <van-icon :name="serviceIcon" size="24" color="#fff" />
            </div>
            <div>
              <h4>{{ serviceData.title }}</h4>
              <span class="order-service-price">¥{{ serviceData.price }}</span>
            </div>
          </div>
          <van-cell-group inset>
            <van-field v-model="orderForm.contactName" label="联系人" placeholder="请输入联系人姓名" />
            <van-field v-model="orderForm.contactPhone" label="联系电话" type="tel" placeholder="请输入联系电话" />

            <van-field
              :model-value="countryDisplay"
              is-link
              readonly
              label="国家/地区"
              placeholder="请选择国家/地区"
              @click="showCountryPicker = true"
            />
            <van-field
              v-if="orderForm.country === '其他'"
              v-model="orderForm.customCountry"
              label="自定义国家"
              placeholder="请输入国家/地区名称"
            />

            <van-field
              v-if="orderForm.country === '中国大陆'"
              :model-value="areaDisplay"
              is-link
              readonly
              label="省/市/区"
              placeholder="请选择省市区"
              @click="showAreaPicker = true"
            />

            <van-field v-model="orderForm.detailAddress" label="详细地址" placeholder="请输入小区/街道等具体地址" />
            <van-field v-model="orderForm.remark" label="备注" type="textarea" rows="2" placeholder="其他需要说明的事项（选填）" />
          </van-cell-group>

          <div class="order-submit-area">
            <div class="order-total">
              <span>合计：</span>
              <span class="order-total-price">¥{{ serviceData.price }}</span>
            </div>
            <van-button type="primary" color="#B91C1C" block round :loading="submitting" @click="submitOrder">
              确认预约
            </van-button>
          </div>
        </div>
      </van-popup>

      <!-- 国家选择器（独立于订单弹窗） -->
      <van-popup v-model:show="showCountryPicker" position="bottom" round teleport="body" :z-index="3000">
        <van-picker
          :columns="countryColumns"
          @confirm="onCountryConfirm"
          @cancel="showCountryPicker = false"
          title="选择国家/地区"
        />
      </van-popup>

      <!-- 省市区选择器（独立于订单弹窗） -->
      <van-popup v-model:show="showAreaPicker" position="bottom" round teleport="body" :z-index="3000">
        <van-area
          :area-list="areaList"
          @confirm="onAreaConfirm"
          @cancel="showAreaPicker = false"
          title="选择省市区"
        />
      </van-popup>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { serviceApi, orderApi } from '@/api';
import { showToast, showDialog } from 'vant';
import { areaList } from '@vant/area-data';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const showOrderPopup = ref(false);
const submitting = ref(false);
const showCountryPicker = ref(false);
const showAreaPicker = ref(false);

const countryColumns = [
  '中国大陆', '中国香港', '中国澳门', '中国台湾',
  '美国', '英国', '日本', '韩国', '新加坡', '澳大利亚',
  '加拿大', '德国', '法国', '马来西亚', '泰国', '其他',
];

const orderForm = reactive({
  contactName: '',
  contactPhone: '',
  country: '',
  customCountry: '',
  province: '',
  city: '',
  district: '',
  areaCode: '',
  detailAddress: '',
  remark: '',
});

const countryDisplay = computed(() => {
  if (orderForm.country === '其他' && orderForm.customCountry) return `其他 - ${orderForm.customCountry}`;
  return orderForm.country || '';
});

const areaDisplay = computed(() => {
  if (orderForm.province) return `${orderForm.province} ${orderForm.city} ${orderForm.district}`.trim();
  return '';
});

const onCountryConfirm = ({ selectedValues, selectedOptions }) => {
  orderForm.country = selectedOptions[0]?.text || selectedValues[0] || '';
  orderForm.province = '';
  orderForm.city = '';
  orderForm.district = '';
  orderForm.areaCode = '';
  orderForm.customCountry = '';
  showCountryPicker.value = false;
};

const onAreaConfirm = ({ selectedOptions }) => {
  orderForm.province = selectedOptions[0]?.text || '';
  orderForm.city = selectedOptions[1]?.text || '';
  orderForm.district = selectedOptions[2]?.text || '';
  orderForm.areaCode = selectedOptions[2]?.value || '';
  showAreaPicker.value = false;
};

const buildFullAddress = () => {
  let parts = [];
  if (orderForm.country === '其他') {
    parts.push(orderForm.customCountry || '其他');
  } else if (orderForm.country) {
    parts.push(orderForm.country);
  }
  if (orderForm.country === '中国大陆' && orderForm.province) {
    parts.push(orderForm.province, orderForm.city, orderForm.district);
  }
  if (orderForm.detailAddress) parts.push(orderForm.detailAddress);
  return parts.filter(Boolean).join(' ');
};

const onBookClick = () => {
  const token = localStorage.getItem('vino_token');
  if (!token) {
    showDialog({ title: '未登录', message: '请先登录后再预约服务' }).then(() => {
      router.push('/login');
    });
    return;
  }
  showOrderPopup.value = true;
};

const fallbackServices = {
  1: { title: '设备维修', description: '专业工程师提供全方位维修服务，品质保障，售后无忧。', price: '99', originPrice: '159', icon: 'setting-o', bg: 'linear-gradient(135deg, #B91C1C, #991B1B)' },
  2: { title: '上门维修', description: '快速响应，工程师2小时内上门服务。', price: '149', originPrice: '199', icon: 'location-o', bg: 'linear-gradient(135deg, #DC2626, #B91C1C)' },
  3: { title: '远程支持', description: '在线视频指导，远程诊断问题。', price: '29', originPrice: '49', icon: 'phone-o', bg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
  4: { title: '深度清洁', description: '全方位清洁保养，焕然一新。', price: '149', originPrice: '199', icon: 'brush-o', bg: 'linear-gradient(135deg, #2563EB, #1D4ED8)' },
  5: { title: '日常清洁', description: '基础维护清洁，保持良好状态。', price: '69', originPrice: '89', icon: 'smile-o', bg: 'linear-gradient(135deg, #3B82F6, #2563EB)' },
  6: { title: '全面检测', description: '系统全面评估，发现潜在问题。', price: '49', originPrice: '79', icon: 'scan', bg: 'linear-gradient(135deg, #059669, #047857)' },
  7: { title: '性能优化', description: '提速升级，优化系统性能。', price: '79', originPrice: '129', icon: 'fire-o', bg: 'linear-gradient(135deg, #10B981, #059669)' },
  8: { title: '数据恢复', description: '专业数据找回，高成功率。', price: '199', originPrice: '299', icon: 'replay', bg: 'linear-gradient(135deg, #7C3AED, #6D28D9)' },
  9: { title: '数据备份', description: '安全迁移，完整备份保护。', price: '59', originPrice: '89', icon: 'description', bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
};

const serviceData = ref({ title: '', description: '', price: '0' });
const serviceIcon = ref('setting-o');
const coverBg = ref('linear-gradient(135deg, #B91C1C, #7F1D1D)');

const features = [
  { title: '品质保障', desc: '全部原装配件', icon: 'shield-o' },
  { title: '快速响应', desc: '2小时内上门', icon: 'clock-o' },
  { title: '透明报价', desc: '无隐形消费', icon: 'balance-list-o' },
  { title: '售后无忧', desc: '90天质保', icon: 'certificate' },
];

onMounted(async () => {
  const id = route.params.id;
  try {
    const res = await serviceApi.detail(id);
    serviceData.value = res.data;
  } catch {
    const fb = fallbackServices[id] || fallbackServices[1];
    serviceData.value = { title: fb.title, description: fb.description, price: fb.price, originPrice: fb.originPrice };
    serviceIcon.value = fb.icon;
    coverBg.value = fb.bg;
  } finally {
    loading.value = false;
  }
});

const submitOrder = async () => {
  if (!orderForm.contactName.trim()) { showToast('请输入联系人'); return; }
  if (!orderForm.contactPhone.trim()) { showToast('请输入联系电话'); return; }
  if (!orderForm.country) { showToast('请选择国家/地区'); return; }
  if (orderForm.country === '其他' && !orderForm.customCountry.trim()) { showToast('请输入国家/地区名称'); return; }
  if (orderForm.country === '中国大陆' && !orderForm.province) { showToast('请选择省市区'); return; }
  if (!orderForm.detailAddress.trim()) { showToast('请输入详细地址'); return; }

  const fullAddress = buildFullAddress();
  submitting.value = true;
  try {
    await orderApi.create({
      serviceId: Number(route.params.id) || null,
      serviceTitle: serviceData.value.title,
      serviceIcon: serviceIcon.value,
      price: serviceData.value.price,
      contactName: orderForm.contactName.trim(),
      contactPhone: orderForm.contactPhone.trim(),
      address: fullAddress,
      remark: orderForm.remark.trim(),
    });
    showOrderPopup.value = false;
    showDialog({ title: '预约成功', message: '您的服务已预约成功，我们会尽快安排工程师。' }).then(() => {
      router.push('/orders');
    });
  } catch (err) {
    showToast(err.message || '下单失败');
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.detail-page {
  background: var(--vino-bg);
  min-height: 100vh;
  padding-bottom: 80px;
}

.page-loading {
  padding-top: 120px;
  text-align: center;
}

.detail-cover {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-body {
  background: var(--vino-card);
  border-radius: 16px 16px 0 0;
  margin-top: -20px;
  position: relative;
  padding: 24px 16px;
}

.detail-body h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.detail-desc {
  font-size: 14px;
  color: var(--vino-text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-price {
  font-size: 24px;
  font-weight: 700;
  color: var(--vino-primary);
}

.origin-price {
  font-size: 14px;
  color: #ccc;
  text-decoration: line-through;
}

.detail-body h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.feature-item h4 {
  font-size: 14px;
  margin-bottom: 2px;
}

.feature-item p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

.detail-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  max-width: 750px;
  margin: 0 auto;
  background: var(--vino-card);
  padding: 10px 16px;
  display: flex;
  gap: 10px;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.detail-footer .van-button--default {
  flex-shrink: 0;
}

.detail-footer .van-button--primary {
  flex: 1;
}

.order-popup {
  padding: 20px 16px 24px;
}

.order-popup h3 {
  font-size: 17px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 16px;
}

.order-service-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--vino-bg, #f5f5f5);
  border-radius: 10px;
  margin-bottom: 16px;
}

.order-service-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.order-service-info h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.order-service-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
}

.order-submit-area {
  padding: 16px 0 0;
}

.order-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
}

.order-total-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--vino-primary, #B91C1C);
  margin-left: 4px;
}
</style>
