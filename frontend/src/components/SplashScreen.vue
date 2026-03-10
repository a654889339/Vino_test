<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" @click="dismiss">
      <div class="splash-content">
        <div class="splash-logo-wrapper">
          <img
            src="https://itsyourturnmy-1256887166.cos.ap-singapore.myqcloud.com/vino/splash-logo.svg"
            alt="VINO"
            class="splash-logo"
          />
        </div>
        <div class="splash-text">
          <span v-for="(char, i) in textChars" :key="i" class="splash-char" :style="{ animationDelay: `${1.2 + i * 0.08}s` }">{{ char }}</span>
        </div>
        <div class="splash-progress">
          <div class="splash-progress-bar"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const visible = ref(true);
const textChars = '即将打开VINO服务站...'.split('');

const dismiss = () => {
  visible.value = false;
};

onMounted(() => {
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
  background: #000;
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

.splash-logo-wrapper {
  animation: logoEnter 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: scale(0.6);
}

.splash-logo {
  width: 280px;
  height: auto;
  filter: drop-shadow(0 0 30px rgba(185, 28, 28, 0.4));
}

.splash-text {
  display: flex;
  justify-content: center;
  gap: 1px;
  min-height: 24px;
}

.splash-char {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 2px;
  opacity: 0;
  transform: translateY(8px);
  animation: charIn 0.4s ease forwards;
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

@keyframes logoEnter {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  60% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
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
