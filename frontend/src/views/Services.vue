<template>
  <div class="services-page">
    <van-nav-bar title="全部服务" />

    <!-- 服务指南 -->
    <div class="guide-section">
      <div class="guide-header">
        <h3>服务指南</h3>
        <span class="guide-more" @click="showAllGuides = true">查看全部 ›</span>
      </div>
      <div class="guide-scroll">
        <div
          v-for="device in deviceGuides"
          :key="device.id"
          class="guide-card"
          @click="openGuide(device)"
        >
          <div class="guide-icon-wrapper" :style="{ background: device.iconUrl ? '#fff' : device.gradient }">
            <img v-if="device.iconUrl" :src="device.iconUrl" class="guide-icon-img" />
            <van-icon v-else :name="device.icon" size="28" color="#fff" />
            <span v-if="device.badge" class="guide-badge">{{ device.badge }}</span>
          </div>
          <div class="guide-info">
            <h4>{{ device.name }}</h4>
            <p>{{ device.model }}</p>
          </div>
        </div>
      </div>
    </div>

    <van-tabs v-model:active="activeTab" sticky color="var(--vino-primary)">
      <van-tab v-for="cat in categories" :key="cat.key" :title="cat.name">
        <div class="service-grid">
          <div
            v-for="item in cat.items"
            :key="item.id"
            class="grid-card"
            @click="$router.push(`/service/${item.id}`)"
          >
            <div class="grid-icon" :style="{ background: item.bg }">
              <van-icon :name="item.icon" size="26" color="#fff" />
            </div>
            <h4>{{ item.title }}</h4>
            <p>{{ item.desc }}</p>
            <span class="grid-price">¥{{ item.price }}起</span>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <!-- 设备指南详情弹窗 -->
    <van-popup
      v-model:show="showGuideDetail"
      position="bottom"
      round
      :style="{ maxHeight: '80%' }"
    >
      <div class="guide-detail" v-if="currentGuide">
        <div class="guide-detail-header" :style="{ background: currentGuide.gradient }">
          <van-icon :name="currentGuide.icon" size="40" color="#fff" />
          <div>
            <h3>{{ currentGuide.name }}</h3>
            <p>{{ currentGuide.model }}</p>
          </div>
        </div>
        <div class="guide-detail-body">
          <div class="guide-detail-section" v-for="(section, idx) in currentGuide.sections" :key="idx">
            <h4>
              <van-icon :name="section.icon" size="16" />
              {{ section.title }}
            </h4>
            <ul>
              <li v-for="(tip, i) in section.tips" :key="i">{{ tip }}</li>
            </ul>
          </div>
          <div class="guide-detail-tags">
            <van-tag v-for="tag in currentGuide.tags" :key="tag" plain type="primary" color="#B91C1C" size="medium">{{ tag }}</van-tag>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 全部设备指南弹窗 -->
    <van-popup
      v-model:show="showAllGuides"
      position="bottom"
      round
      :style="{ maxHeight: '85%' }"
    >
      <div class="all-guides">
        <div class="all-guides-title">
          <h3>全部设备指南</h3>
        </div>
        <div class="all-guides-grid">
          <div
            v-for="device in deviceGuides"
            :key="device.id"
            class="all-guide-item"
            @click="showAllGuides = false; openGuide(device)"
          >
            <div class="all-guide-icon" :style="{ background: device.iconUrl ? '#fff' : device.gradient }">
              <img v-if="device.iconUrl" :src="device.iconUrl" class="guide-icon-img-sm" />
              <van-icon v-else :name="device.icon" size="24" color="#fff" />
            </div>
            <div class="all-guide-info">
              <h4>{{ device.name }}</h4>
              <p>{{ device.model }}</p>
            </div>
            <van-icon name="arrow" size="14" color="#ccc" />
          </div>
        </div>
      </div>
    </van-popup>

    <div style="height: 60px;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { guideApi, serviceApi } from '@/api';

const router = useRouter();
const activeTab = ref(0);
const showGuideDetail = ref(false);
const showAllGuides = ref(false);
const currentGuide = ref(null);

const deviceGuides = ref([]);
const categories = ref([]);

const openGuide = (device) => {
  router.push(`/guide/${device.id}`);
};

const fallbackGuides = [
  { id: 1, name: '空调', model: '家用 / 商用中央空调', icon: 'cluster-o', gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)', badge: '热门', tags: ['制冷维修', '清洗保养', '加氟充注', '故障排查'], sections: [{ title: '日常维护', icon: 'shield-o', tips: ['每月清洗一次过滤网', '室外机周围保持通风', '换季使用前先送风运行30分钟', '定期检查排水管是否通畅'] }, { title: '故障排查', icon: 'warning-o', tips: ['不制冷/制热：检查温度设置及滤网', '漏水：检查排水管', '异响：检查风扇叶片', '遥控器无反应：更换电池'] }] },
  { id: 2, name: '除湿机', model: '家用 / 工业除湿设备', icon: 'filter-o', gradient: 'linear-gradient(135deg, #0891B2, #67E8F9)', badge: '', tags: ['除湿效率', '水箱清洁', '滤网更换'], sections: [] },
  { id: 3, name: '光储一体机', model: '户用光储一体化系统', icon: 'fire-o', gradient: 'linear-gradient(135deg, #D97706, #FBBF24)', badge: '新', tags: ['储能管理', '并离网切换'], sections: [] },
  { id: 4, name: '光伏变电器', model: '汇流箱 / 变压器 / 配电柜', icon: 'balance-list-o', gradient: 'linear-gradient(135deg, #059669, #34D399)', badge: '', tags: ['电气安全', '汇流检测'], sections: [] },
  { id: 5, name: '逆变器', model: '组串式 / 集中式 / 微型逆变器', icon: 'replay', gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)', badge: '', tags: ['直流转交流', 'MPPT追踪'], sections: [] },
];

const fallbackCategories = [
  { key: 'repair', name: '维修', items: [
    { id: 1, title: '设备维修', desc: '专业工程师', icon: 'setting-o', price: '99', bg: '#B91C1C' },
    { id: 2, title: '上门维修', desc: '快速响应', icon: 'location-o', price: '149', bg: '#DC2626' },
    { id: 3, title: '远程支持', desc: '在线指导', icon: 'phone-o', price: '29', bg: '#EF4444' },
  ]},
  { key: 'clean', name: '清洁', items: [
    { id: 4, title: '深度清洁', desc: '全方位保养', icon: 'brush-o', price: '149', bg: '#2563EB' },
    { id: 5, title: '日常清洁', desc: '基础维护', icon: 'smile-o', price: '69', bg: '#3B82F6' },
  ]},
  { key: 'inspect', name: '检测', items: [
    { id: 6, title: '全面检测', desc: '系统评估', icon: 'scan', price: '49', bg: '#059669' },
    { id: 7, title: '性能优化', desc: '提速升级', icon: 'fire-o', price: '79', bg: '#10B981' },
  ]},
  { key: 'data', name: '数据', items: [
    { id: 8, title: '数据恢复', desc: '专业找回', icon: 'replay', price: '199', bg: '#7C3AED' },
    { id: 9, title: '数据备份', desc: '安全迁移', icon: 'description', price: '59', bg: '#8B5CF6' },
  ]},
];

const categoryColors = { repair: '#B91C1C', clean: '#2563EB', inspect: '#059669', data: '#7C3AED' };

onMounted(async () => {
  try {
    const res = await guideApi.list();
    const list = res.data || [];
    deviceGuides.value = list.map(g => ({
      ...g,
      model: g.subtitle,
      tags: Array.isArray(g.tags) ? g.tags : JSON.parse(g.tags || '[]'),
      sections: Array.isArray(g.sections) ? g.sections : JSON.parse(g.sections || '[]'),
    }));
  } catch {
    deviceGuides.value = fallbackGuides;
  }

  try {
    const res = await serviceApi.list();
    const services = res.data?.list || res.data || [];
    if (services.length) {
      const catMap = {};
      services.forEach(s => {
        const cat = s.category || 'repair';
        if (!catMap[cat]) catMap[cat] = { key: cat, name: cat === 'repair' ? '维修' : cat === 'clean' ? '清洁' : cat === 'inspect' ? '检测' : cat === 'data' ? '数据' : cat, items: [] };
        catMap[cat].items.push({ id: s.id, title: s.title, desc: s.description || '', icon: s.icon || 'setting-o', price: s.price || 0, bg: categoryColors[cat] || '#B91C1C' });
      });
      categories.value = Object.values(catMap);
    } else {
      categories.value = fallbackCategories;
    }
  } catch {
    categories.value = fallbackCategories;
  }
});
</script>

<style scoped>
.services-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.services-page :deep(.van-nav-bar) {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.services-page :deep(.van-nav-bar__title) {
  font-weight: 600;
  font-size: 17px;
  color: var(--vino-dark);
}

/* ===== Guide Section ===== */
.guide-section {
  background: var(--vino-card);
  padding: 20px 20px 16px;
  margin-bottom: 8px;
  animation: fadeInUp 0.4s var(--vino-transition) both;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.guide-header h3 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.guide-more {
  font-size: 14px;
  color: var(--vino-primary);
  font-weight: 500;
  cursor: pointer;
}

.guide-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.guide-scroll::-webkit-scrollbar { display: none; }

.guide-card {
  min-width: 135px;
  flex-shrink: 0;
  background: var(--vino-bg);
  border-radius: var(--vino-radius);
  padding: 16px 14px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
}

.guide-card:active {
  transform: scale(0.95);
}

.guide-icon-wrapper {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}

.guide-icon-img { width: 100%; height: 100%; object-fit: contain; }
.guide-icon-img-sm { width: 100%; height: 100%; object-fit: contain; }

.guide-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: var(--vino-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
}

.guide-info h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  white-space: nowrap;
  color: var(--vino-dark);
}

.guide-info p {
  font-size: 12px;
  color: var(--vino-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

/* ===== Tabs ===== */
.services-page :deep(.van-tabs__nav) {
  background: #fff;
}

.services-page :deep(.van-tab--active) {
  font-weight: 600;
}

/* ===== Service Grid ===== */
.service-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px 20px;
}

.grid-card {
  background: var(--vino-card);
  border-radius: var(--vino-radius);
  padding: 18px 16px;
  cursor: pointer;
  transition: transform 0.25s var(--vino-transition);
  box-shadow: var(--vino-shadow);
}

.grid-card:active {
  transform: scale(0.96);
}

.grid-icon {
  width: 50px;
  height: 50px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.grid-card h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--vino-dark);
}

.grid-card p {
  font-size: 13px;
  color: var(--vino-text-secondary);
  margin-bottom: 10px;
}

.grid-price {
  font-size: 17px;
  font-weight: 700;
  color: var(--vino-primary);
  letter-spacing: -0.02em;
}

/* ===== Guide Detail Popup ===== */
.guide-detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 24px;
  border-radius: 16px 16px 0 0;
}

.guide-detail-header h3 {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.guide-detail-header p {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 4px;
}

.guide-detail-body {
  padding: 20px 24px 28px;
}

.guide-detail-section {
  margin-bottom: 20px;
}

.guide-detail-section h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vino-dark);
}

.guide-detail-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guide-detail-section li {
  font-size: 14px;
  color: var(--vino-text-secondary);
  padding: 7px 0 7px 18px;
  position: relative;
  line-height: 1.5;
}

.guide-detail-section li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 14px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vino-primary);
}

.guide-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 8px;
}

/* ===== All Guides Popup ===== */
.all-guides {
  padding: 0 0 28px;
}

.all-guides-title {
  padding: 24px 24px 14px;
  text-align: center;
}

.all-guides-title h3 {
  font-size: 20px;
  font-weight: 700;
}

.all-guides-grid {
  padding: 0 16px;
}

.all-guide-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  border-radius: var(--vino-radius-sm);
  cursor: pointer;
  transition: background 0.2s;
}

.all-guide-item:active {
  background: var(--vino-bg);
}

.all-guide-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.all-guide-info {
  flex: 1;
  min-width: 0;
}

.all-guide-info h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 3px;
  color: var(--vino-dark);
}

.all-guide-info p {
  font-size: 13px;
  color: var(--vino-text-secondary);
}
</style>
