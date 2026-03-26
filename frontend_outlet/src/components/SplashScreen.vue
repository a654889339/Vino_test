<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" :style="{ background: backgroundColor }" @click="dismiss">
      <div class="splash-content">
        <!-- 红框处：后台配置的开场动画描述 -->
        <div class="splash-desc" v-if="displayText">{{ displayText }}</div>
        <div class="splash-progress">
          <div class="splash-progress-bar"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { homeConfigApi } from '@/api';

const visible = ref(true);
const splashConfig = ref(null);

// 获取背景色：优先使用配置的 color，否则使用默认黑色
const backgroundColor = computed(() => {
  return splashConfig.value?.color || '#000';
});

// 获取显示文本：优先使用配置的描述，否则使用默认文本
const displayText = computed(() => {
  if (splashConfig.value?.desc) {
    return splashConfig.value.desc;
  }
  if (splashConfig.value?.title) {
    return `即将打开${splashConfig.value.title}...`;
  }
  return '即将打开VINO服务站...';
});


const dismiss = () => {
  visible.value = false;
};

// 加载开场动画配置
const loadSplashConfig = async () => {
  try {
    const res = await homeConfigApi.list();
    if (res.data) {
      // 查找 section 为 splash 且状态为 active 的配置
      const splash = res.data.find(item => item.section === 'splash' && item.status === 'active');
      if (splash) {
        splashConfig.value = splash;
      }
    }
  } catch (error) {
    console.error('加载开场动画配置失败:', error);
  }
};

onMounted(async () => {
  // 先加载配置
  await loadSplashConfig();

  // 3.2秒后自动关闭
  setTimeout(() => {
    visible.value = false;
  }, 3200);
});
</script>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  /* 背景色通过 :style 动态绑定 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 320px;
  width: 100%;
  padding: 0 24px;
}

/* 红框处：后台配置的开场动画描述 */
.splash-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  letter-spacing: 1px;
  line-height: 1.5;
  max-width: 280px;
  min-height: 24px;
  opacity: 0;
  animation: charIn 0.5s 0.8s ease forwards;
}

.splash-progress {
  width: 120px;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  opacity: 0;
  animation: fadeIn 0.3s 1.2s ease forwards;
}

.splash-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #B91C1C, #EF4444);
  border-radius: 2px;
  animation: progressFill 1.8s 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  width: 0;
}

@keyframes charIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}

@keyframes progressFill {
  to {
    width: 100%;
  }
}

.splash-fade-leave-active {
  transition: opacity 0.5s ease;
}

.splash-fade-leave-to {
  opacity: 0;
}
</style>
