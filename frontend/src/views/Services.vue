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
              <van-icon :name="item.icon" size="28" color="#fff" />
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
  {
    id: 1,
    name: '空调',
    model: '家用 / 商用中央空调',
    icon: 'cluster-o',
    gradient: 'linear-gradient(135deg, #2563EB, #60A5FA)',
    badge: '热门',
    tags: ['制冷维修', '清洗保养', '加氟充注', '故障排查'],
    sections: [
      { title: '日常维护', icon: 'shield-o', tips: ['每月清洗一次过滤网，保持进风通畅', '室外机周围保持通风，不要堆放杂物', '换季使用前先送风运行 30 分钟', '定期检查排水管是否通畅，防止漏水'] },
      { title: '故障排查', icon: 'warning-o', tips: ['不制冷/制热：检查温度设置及滤网是否堵塞', '漏水：检查排水管是否弯折或堵塞', '异响：检查风扇叶片及压缩机运行状态', '遥控器无反应：更换电池或对准接收窗口'] },
      { title: '保养建议', icon: 'clock-o', tips: ['每年至少做一次专业深度清洗', '每 2-3 年检查制冷剂是否不足', '冬季长期不用时断电并盖好外机防尘罩'] },
    ],
  },
  {
    id: 2,
    name: '除湿机',
    model: '家用 / 工业除湿设备',
    icon: 'filter-o',
    gradient: 'linear-gradient(135deg, #0891B2, #67E8F9)',
    badge: '',
    tags: ['除湿效率', '水箱清洁', '滤网更换', '运行维护'],
    sections: [
      { title: '使用指南', icon: 'shield-o', tips: ['关闭门窗使用，提高除湿效率', '水箱水满后及时排水或连接外排管', '避免在高温环境下长时间运行', '放置在房间中央位置效果最佳'] },
      { title: '维护保养', icon: 'clock-o', tips: ['每两周清洗一次空气滤网', '定期清洁水箱内壁防止细菌滋生', '冬季存放时清洁擦干后竖直放置', '检查电源线是否有老化磨损'] },
      { title: '故障排查', icon: 'warning-o', tips: ['不除湿：检查温度是否过低（低于 5°C 效率降低）', '噪音大：检查是否放置平稳，压缩机是否异常', '漏水：检查水箱是否到位，排水口是否堵塞'] },
    ],
  },
  {
    id: 3,
    name: '光储一体机',
    model: '户用光储一体化系统',
    icon: 'fire-o',
    gradient: 'linear-gradient(135deg, #D97706, #FBBF24)',
    badge: '新',
    tags: ['储能管理', '并离网切换', '电池维护', '系统监控'],
    sections: [
      { title: '系统概述', icon: 'shield-o', tips: ['光储一体机集成光伏逆变与储能功能', '支持并网/离网/自动切换三种模式', '可通过 APP 远程监控发电及用电数据', '电池容量和光伏功率需匹配合理设计'] },
      { title: '日常维护', icon: 'clock-o', tips: ['定期检查电池充放电状态是否正常', '保持设备通风散热，避免阳光直射机柜', '雷雨季节检查防雷接地是否完好', '每季度检查线缆连接是否紧固无松动'] },
      { title: '故障处理', icon: 'warning-o', tips: ['离网不供电：检查电池电量和逆变器状态', '充电异常：检查光伏板是否有遮挡或积灰', '报警代码：记录报警信息并联系售后工程师', '切勿自行拆卸电池模组，存在触电危险'] },
    ],
  },
  {
    id: 4,
    name: '光伏变电器',
    model: '汇流箱 / 变压器 / 配电柜',
    icon: 'balance-list-o',
    gradient: 'linear-gradient(135deg, #059669, #34D399)',
    badge: '',
    tags: ['电气安全', '汇流检测', '防雷保护', '绝缘监测'],
    sections: [
      { title: '设备说明', icon: 'shield-o', tips: ['光伏变电器负责电压转换和电力分配', '汇流箱将多路光伏串合并后接入逆变器', '配电柜实现并网输出和负载分配', '需严格按照电气规范安装和操作'] },
      { title: '巡检要点', icon: 'clock-o', tips: ['每月检查接线端子是否发热或变色', '定期测试防雷器件是否失效', '检查绝缘电阻值是否在正常范围', '暴雨后检查柜体密封和排水情况'] },
      { title: '安全须知', icon: 'warning-o', tips: ['操作前务必断开直流和交流开关', '带电检测必须使用专业绝缘工具', '未经培训人员禁止打开配电柜', '发现异味、冒烟立即断电并报修'] },
    ],
  },
  {
    id: 5,
    name: '逆变器',
    model: '组串式 / 集中式 / 微型逆变器',
    icon: 'replay',
    gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    badge: '',
    tags: ['直流转交流', 'MPPT 追踪', '并网保护', '效率监测'],
    sections: [
      { title: '工作原理', icon: 'shield-o', tips: ['逆变器将光伏板产生的直流电转为交流电', 'MPPT 功能实时追踪最佳功率输出点', '组串式逆变器适合户用和小型商用场景', '微型逆变器实现组件级功率优化和监控'] },
      { title: '日常维护', icon: 'clock-o', tips: ['保持散热风道通畅，定期清理灰尘', '检查显示屏或 APP 上的发电数据是否正常', '确认交流输出电压和频率在标准范围内', '每年进行一次绝缘和接地电阻测试'] },
      { title: '常见故障', icon: 'warning-o', tips: ['不并网：检查电网电压是否超限或逆变器保护', '发电量低：检查组件是否遮挡、积灰或损坏', '报故障码：记录代码后联系厂家或专业工程师', '风扇异响：可能灰尘堆积，需清洁或更换风扇'] },
    ],
  },
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

/* 服务指南 */
.guide-section {
  background: var(--vino-card);
  padding: 16px 16px 12px;
  margin-bottom: 8px;
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.guide-header h3 {
  font-size: 17px;
  font-weight: 600;
}

.guide-more {
  font-size: 13px;
  color: var(--vino-text-secondary);
  cursor: pointer;
}

.guide-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 4px;
}

.guide-scroll::-webkit-scrollbar {
  display: none;
}

.guide-card {
  min-width: 130px;
  flex-shrink: 0;
  background: var(--vino-bg);
  border-radius: 12px;
  padding: 14px 12px;
  cursor: pointer;
  transition: transform 0.2s;
}

.guide-card:active {
  transform: scale(0.96);
}

.guide-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
}
.guide-icon-img { width: 100%; height: 100%; object-fit: contain; }
.guide-icon-img-sm { width: 100%; height: 100%; object-fit: contain; }

.guide-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: #B91C1C;
  color: #fff;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 6px;
  white-space: nowrap;
}

.guide-info h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 3px;
  white-space: nowrap;
}

.guide-info p {
  font-size: 11px;
  color: var(--vino-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

/* 设备指南详情弹窗 */
.guide-detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px 20px;
  border-radius: 16px 16px 0 0;
}

.guide-detail-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.guide-detail-header p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
}

.guide-detail-body {
  padding: 16px 20px 24px;
}

.guide-detail-section {
  margin-bottom: 18px;
}

.guide-detail-section h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--vino-text);
}

.guide-detail-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guide-detail-section li {
  font-size: 13px;
  color: var(--vino-text-secondary);
  padding: 6px 0 6px 16px;
  position: relative;
  line-height: 1.5;
}

.guide-detail-section li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 13px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #B91C1C;
}

.guide-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

/* 全部设备指南弹窗 */
.all-guides {
  padding: 0 0 24px;
}

.all-guides-title {
  padding: 20px 20px 12px;
  text-align: center;
}

.all-guides-title h3 {
  font-size: 17px;
  font-weight: 600;
}

.all-guides-grid {
  padding: 0 16px;
}

.all-guide-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.all-guide-item:active {
  background: var(--vino-bg);
}

.all-guide-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
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
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
}

.all-guide-info p {
  font-size: 12px;
  color: var(--vino-text-secondary);
}

/* 服务列表 */
.service-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px;
}

.grid-card {
  background: var(--vino-card);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.grid-card:active {
  transform: scale(0.97);
}

.grid-icon {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.grid-card h4 {
  font-size: 15px;
  margin-bottom: 4px;
}

.grid-card p {
  font-size: 12px;
  color: var(--vino-text-secondary);
  margin-bottom: 8px;
}

.grid-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--vino-primary);
}
</style>
