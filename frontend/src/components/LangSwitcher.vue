<template>
  <div class="lang-switcher" @click="toggle">
    <span class="lang-label">{{ isEn ? 'EN' : t('lang.zhLabel') }}</span>
    <van-icon :name="open ? 'arrow-up' : 'arrow-down'" size="12" color="rgba(255,255,255,0.7)" />
    <Transition name="lang-drop">
      <div v-if="open" class="lang-dropdown" @click.stop>
        <div class="lang-option" :class="{ active: !isEn }" @click="select('zh')">{{ t('lang.zhName') }}</div>
        <div class="lang-option" :class="{ active: isEn }" @click="select('en')">English</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { currentLang, isEn, setLang, t } from '@/utils/i18n';

const open = ref(false);
const toggle = () => { open.value = !open.value; };
const select = (lang) => { setLang(lang); open.value = false; };
</script>

<style scoped>
.lang-switcher {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 16px;
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(4px);
  user-select: none;
}
.lang-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  letter-spacing: 0.5px;
}
.lang-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  z-index: 100;
  min-width: 90px;
}
.lang-option {
  padding: 10px 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}
.lang-option:hover {
  background: #f5f5f5;
}
.lang-option.active {
  color: #B91C1C;
  font-weight: 600;
}
.lang-drop-enter-active, .lang-drop-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.lang-drop-enter-from, .lang-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
