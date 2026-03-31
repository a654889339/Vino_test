<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" :style="{ background: backgroundColor }" @click="dismiss">
      <div class="splash-content">
        <img v-if="splashImageUrl" :src="splashImageUrl" class="splash-logo-img" alt="" />
        <div class="splash-desc" v-if="displayText" :style="{ color: textColor }">{{ displayText }}</div>
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
import { pick } from '@/utils/i18n';

const visible = ref(true);
const splashConfig = ref(null);

const backgroundColor = computed(() => {
  return splashConfig.value?.color || '#000';
});

const splashImageUrl = computed(() => {
  return pick(splashConfig.value, 'imageUrl') || '';
});

const isLightBg = computed(() => {
  const c = (splashConfig.value?.color || '').trim().toLowerCase();
  if (!c || c === '#000' || c === '#000000' || c === 'black') return false;
  if (c === '#fff' || c === '#ffffff' || c === 'white') return true;
  if (c.startsWith('#') && c.length >= 4) {
    const hex = c.length <= 5
      ? c.slice(1).split('').map(h => parseInt(h + h, 16))
      : [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map(h => parseInt(h, 16));
    if (hex.length >= 3 && hex.every(v => !isNaN(v))) {
      return (hex[0] * 0.299 + hex[1] * 0.587 + hex[2] * 0.114) > 186;
    }
  }
  return false;
});

const textColor = computed(() => {
  return isLightBg.value ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.85)';
});

const displayText = computed(() => {
  if (splashConfig.value?.desc) return splashConfig.value.desc;
  if (splashConfig.value?.title) return splashConfig.value.title;
  return '';
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

.splash-logo-img {
  max-width: 180px;
  max-height: 120px;
  object-fit: contain;
  opacity: 0;
  animation: charIn 0.6s 0.3s ease forwards;
}

.splash-desc {
  font-size: 15px;
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
