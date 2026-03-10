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
          <div class="guide-icon-wrapper" :style="{ background: device.gradient }">
            <van-icon :name="device.icon" size="28" color="#fff" />
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
            <div class="all-guide-icon" :style="{ background: device.gradient }">
              <van-icon :name="device.icon" size="24" color="#fff" />
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
import { ref } from 'vue';

const activeTab = ref(0);
const showGuideDetail = ref(false);
const showAllGuides = ref(false);
const currentGuide = ref(null);

const openGuide = (device) => {
  currentGuide.value = device;
  showGuideDetail.value = true;
};

const deviceGuides = [
  {
    id: 1,
    name: '笔记本电脑',
    model: 'MacBook / ThinkPad / Dell',
    icon: 'laptop',
    gradient: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
    badge: '热门',
    tags: ['散热维护', '电池保养', '屏幕清洁', '系统优化'],
    sections: [
      { title: '日常维护', icon: 'shield-o', tips: ['保持散热口清洁通畅，避免堵塞', '电池建议保持 20%-80% 的充电范围', '使用专业清洁剂擦拭屏幕，切勿直接喷水', '定期清理系统垃圾，保持磁盘空间充足'] },
      { title: '故障排查', icon: 'warning-o', tips: ['无法开机：长按电源键 15 秒后重试', '运行缓慢：检查后台进程与磁盘空间', '蓝屏/死机：记录错误代码，联系专业工程师', 'WiFi 不稳定：重置网络设置或更新驱动'] },
      { title: '保养建议', icon: 'clock-o', tips: ['每 6 个月做一次深度清灰', '每年检查电池健康度', '及时更新系统和安全补丁'] },
    ],
  },
  {
    id: 2,
    name: '台式电脑',
    model: 'DIY 组装 / 品牌机',
    icon: 'tv-o',
    gradient: 'linear-gradient(135deg, #7C3AED, #A78BFA)',
    badge: '',
    tags: ['硬件升级', '散热方案', '电源管理', '性能调优'],
    sections: [
      { title: '日常维护', icon: 'shield-o', tips: ['保持机箱内部清洁，定期除尘', '检查风扇运转是否正常', '理线整洁有利于散热和维护', '使用 UPS 或稳压器保护电源'] },
      { title: '硬件升级', icon: 'upgrade', tips: ['加装内存条提升多任务性能', 'SSD 替换 HDD 大幅提升启动速度', '显卡升级前检查电源功率是否足够', '升级前做好数据备份'] },
      { title: '故障排查', icon: 'warning-o', tips: ['无法开机：检查电源线、内存条接触', '蓝屏报错：记录代码，逐一排除硬件', '异响：检查风扇和硬盘是否正常'] },
    ],
  },
  {
    id: 3,
    name: '智能手机',
    model: 'iPhone / Android 旗舰',
    icon: 'phone-o',
    gradient: 'linear-gradient(135deg, #059669, #34D399)',
    badge: '新',
    tags: ['屏幕修复', '电池更换', '数据迁移', '防水检测'],
    sections: [
      { title: '日常使用', icon: 'shield-o', tips: ['使用原装或 MFi 认证充电器', '避免长时间暴露在高温环境中', '定期清理缓存和无用应用', '建议使用钢化膜和保护壳'] },
      { title: '电池养护', icon: 'fire-o', tips: ['避免完全放电后再充电', '长时间不用保持 50% 电量存放', '关闭不必要的后台刷新', '检查电池健康度（设置 > 电池）'] },
      { title: '数据安全', icon: 'lock', tips: ['定期备份到云端或电脑', '开启双重认证保护账号', '不随意点击不明链接'] },
    ],
  },
  {
    id: 4,
    name: '平板设备',
    model: 'iPad / Android 平板',
    icon: 'photo-o',
    gradient: 'linear-gradient(135deg, #D97706, #FBBF24)',
    badge: '',
    tags: ['触屏校准', '手写笔配对', '屏幕保护', '系统还原'],
    sections: [
      { title: '使用技巧', icon: 'shield-o', tips: ['使用支架保持合适的观看角度', '定期校准触控屏幕（如有偏移）', '手写笔保持配对并及时充电', '分屏操作提高工作效率'] },
      { title: '维护保养', icon: 'clock-o', tips: ['使用超细纤维布清洁屏幕', '避免长时间高亮度使用', '定期更新系统获取安全补丁', '保护壳可防止意外跌落损伤'] },
    ],
  },
  {
    id: 5,
    name: '打印机',
    model: '喷墨 / 激光 / 一体机',
    icon: 'printer',
    gradient: 'linear-gradient(135deg, #DC2626, #F87171)',
    badge: '',
    tags: ['墨盒更换', '卡纸处理', '网络配置', '打印质量'],
    sections: [
      { title: '常见问题', icon: 'warning-o', tips: ['卡纸：按指示方向缓慢抽出纸张', '打印模糊：清洗打印头或更换墨盒', '无法连接：检查 WiFi 或 USB 线缆', '色彩偏差：执行打印头校准'] },
      { title: '维护建议', icon: 'clock-o', tips: ['每周至少打印一次防止喷头堵塞', '使用推荐纸张类型', '墨粉/墨盒低时及时更换', '放置在干燥通风处'] },
    ],
  },
  {
    id: 6,
    name: '智能家居',
    model: '路由器 / 音箱 / 摄像头',
    icon: 'wap-home-o',
    gradient: 'linear-gradient(135deg, #0891B2, #67E8F9)',
    badge: '',
    tags: ['网络配置', '设备配对', '固件更新', '隐私安全'],
    sections: [
      { title: '网络设置', icon: 'wifi-o', tips: ['路由器放置在房屋中心位置', '2.4G 覆盖广、5G 速度快，按需连接', '定期修改 WiFi 密码', '设备较多时考虑 Mesh 组网'] },
      { title: '安全建议', icon: 'shield-o', tips: ['摄像头不要朝向私密区域', '定期更新设备固件', '关闭不必要的远程访问权限', '使用独立的 IoT 网络隔离'] },
    ],
  },
];

const categories = [
  {
    key: 'repair',
    name: '维修',
    items: [
      { id: 1, title: '设备维修', desc: '专业工程师', icon: 'setting-o', price: '99', bg: '#B91C1C' },
      { id: 2, title: '上门维修', desc: '快速响应', icon: 'location-o', price: '149', bg: '#DC2626' },
      { id: 3, title: '远程支持', desc: '在线指导', icon: 'phone-o', price: '29', bg: '#EF4444' },
    ],
  },
  {
    key: 'clean',
    name: '清洁',
    items: [
      { id: 4, title: '深度清洁', desc: '全方位保养', icon: 'brush-o', price: '149', bg: '#2563EB' },
      { id: 5, title: '日常清洁', desc: '基础维护', icon: 'smile-o', price: '69', bg: '#3B82F6' },
    ],
  },
  {
    key: 'inspect',
    name: '检测',
    items: [
      { id: 6, title: '全面检测', desc: '系统评估', icon: 'scan', price: '49', bg: '#059669' },
      { id: 7, title: '性能优化', desc: '提速升级', icon: 'fire-o', price: '79', bg: '#10B981' },
    ],
  },
  {
    key: 'data',
    name: '数据',
    items: [
      { id: 8, title: '数据恢复', desc: '专业找回', icon: 'replay', price: '199', bg: '#7C3AED' },
      { id: 9, title: '数据备份', desc: '安全迁移', icon: 'description', price: '59', bg: '#8B5CF6' },
    ],
  },
];
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
}

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
