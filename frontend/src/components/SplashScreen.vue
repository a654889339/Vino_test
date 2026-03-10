<template>
  <Transition name="splash-fade">
    <div v-if="visible" class="splash-screen" @click="dismiss">
      <div class="splash-content">
        <div class="splash-logo-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="splash-logo">
            <rect width="520" height="200" fill="#000"/>
            <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
            <path d="M38 35 L55 35 L55 60 L45 35 Z" fill="#000" opacity="0.2"/>
            <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
            <path d="M172 35 L180 35 L180 170 L172 170 Z" fill="#000" opacity="0.15"/>
            <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
            <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
            <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
            <circle cx="498" cy="38" r="10" stroke="#666" stroke-width="1.5" fill="none"/>
            <text x="498" y="43" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" font-weight="bold">R</text>
          </svg>
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
