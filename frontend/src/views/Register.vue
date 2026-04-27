<template>
  <div class="register-page">
    <van-nav-bar :title="t('register.title')" left-arrow @click-left="$router.back()" />

    <van-notice-bar
      v-if="registerDisabled"
      color="#B91C1C"
      background="#FEE2E2"
      left-icon="warning-o"
      :text="registerDisabledText"
      style="margin:12px 16px 0;border-radius:10px"
    />

    <div class="register-header">
      <img
        v-if="brandLogoUrl && !brandLogoError"
        :src="brandLogoUrl"
        alt="Logo"
        class="register-logo-img"
        @error="brandLogoError = true"
      />
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="register-logo">
        <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
        <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
        <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
        <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
        <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
        <circle cx="498" cy="38" r="10" stroke="#999" stroke-width="1.5" fill="none"/>
        <text x="498" y="43" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" font-weight="bold">R</text>
      </svg>
      <h2>{{ t('register.heading') }}</h2>
    </div>

    <div class="register-form">
      <van-tabs v-model:active="registerMode" class="register-tabs">
        <van-tab :title="t('register.tabEmail')" name="email">
          <van-cell-group inset>
            <van-field v-model="form.username" :label="t('register.username')" :placeholder="t('register.usernamePh')" left-icon="manager-o" maxlength="50" />
            <van-field v-model="form.password" type="password" :label="t('register.password')" :placeholder="t('register.passwordPh')" left-icon="lock" autocomplete="new-password" />
            <van-field v-model="form.email" :label="t('register.email')" :placeholder="t('register.emailPh')" left-icon="envelop-o" type="email" />
            <van-field v-model="form.code" :label="t('register.code')" :placeholder="t('register.emailCodePh')" left-icon="shield-o" maxlength="6">
              <template #button>
                <van-button size="small" type="primary" color="#B91C1C" :disabled="countdown > 0 || sendingCode" :loading="sendingCode" @click="handleSendCode">
                  {{ countdown > 0 ? countdown + 's' : t('register.sendEmailCode') }}
                </van-button>
              </template>
            </van-field>
            <van-field v-model="form.nickname" :label="t('register.nickname')" :placeholder="t('register.nicknamePh')" left-icon="contact-o" maxlength="50" />
          </van-cell-group>
        </van-tab>
        <van-tab :title="t('register.tabPhone')" name="phone">
          <van-cell-group inset>
            <van-field v-model="form.phone" :label="t('login.phone')" :placeholder="t('login.phonePh')" left-icon="phone-o" type="tel" maxlength="11" />
            <van-field v-model="form.smsCode" :label="t('register.code')" :placeholder="t('login.smsCodePh')" left-icon="shield-o" maxlength="6">
              <template #button>
                <van-button size="small" type="primary" color="#B91C1C" :disabled="smsCountdown > 0 || sendingSmsCode" :loading="sendingSmsCode" @click="handleSendSmsCode">
                  {{ smsCountdown > 0 ? smsCountdown + 's' : t('login.sendSms') }}
                </van-button>
              </template>
            </van-field>
            <van-field v-model="form.password" type="password" :label="t('register.password')" :placeholder="t('register.passwordPh')" left-icon="lock" autocomplete="new-password" />
            <van-field v-model="form.nickname" :label="t('register.nickname')" :placeholder="t('register.nicknamePh')" left-icon="contact-o" maxlength="50" />
          </van-cell-group>
        </van-tab>
      </van-tabs>

      <div class="register-actions">
        <van-button
          type="primary"
          color="#B91C1C"
          block
          round
          :loading="loading"
          :disabled="registerDisabled"
          @click="handleRegister"
        >
          {{ t('register.submit') }}
        </van-button>
        <p class="login-link">
          {{ t('register.hasAccount') }}<span @click="$router.replace('/login')">{{ t('register.loginLink') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onBeforeUnmount, inject, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { authApi } from '@/api';
import { showToast } from 'vant';
import { t, isEn } from '@/utils/i18n';
import { frontPageLogoUrl } from '@/utils/cosMedia.js';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);
const brandLogoError = ref(false);

const brandLogoUrl = computed(() => frontPageLogoUrl(isEn.value ? 'en' : 'zh'));

watch(isEn, () => {
  brandLogoError.value = false;
});
const sendingCode = ref(false);
const countdown = ref(0);
let timer = null;

const registerMode = ref('email');
const form = reactive({
  username: '',
  password: '',
  email: '',
  code: '',
  nickname: '',
  phone: '',
  smsCode: '',
});
const smsCountdown = ref(0);
const sendingSmsCode = ref(false);
let smsTimer = null;

const injectedStatus = inject('appStatus', null);
const registerDisabled = computed(() => {
  const s = injectedStatus && injectedStatus.value ? injectedStatus.value : null;
  if (!s) return false;
  return s.enableRegister === false;
});
const registerDisabledText = computed(() => t('当前已关闭注册功能，请稍后再试。', 'Registration is currently disabled. Please try again later.'));

const handleSendCode = async () => {
  if (registerDisabled.value) {
    showToast(registerDisabledText.value);
    return;
  }
  if (!form.email) {
    showToast(t('请先输入邮箱', 'Please enter your email first'));
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    showToast(t('邮箱格式不正确', 'Invalid email format'));
    return;
  }
  sendingCode.value = true;
  try {
    await authApi.sendCode({ email: form.email });
    showToast(t('验证码已发送', 'Verification code sent'));
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(timer);
    }, 1000);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || t('发送失败', 'Send failed');
    showToast(msg);
  } finally {
    sendingCode.value = false;
  }
};

const handleSendSmsCode = async () => {
  if (registerDisabled.value) {
    showToast(registerDisabledText.value);
    return;
  }
  if (!/^1\d{10}$/.test(form.phone)) {
    showToast(t('请输入正确的11位手机号', 'Please enter a valid 11-digit phone number'));
    return;
  }
  sendingSmsCode.value = true;
  try {
    await authApi.sendSmsCode({ phone: form.phone, scene: 'register' });
    showToast(t('验证码已发送', 'Verification code sent'));
    smsCountdown.value = 60;
    smsTimer = setInterval(() => {
      smsCountdown.value--;
      if (smsCountdown.value <= 0) clearInterval(smsTimer);
    }, 1000);
  } catch (err) {
    const msg = err.response?.data?.message || err.message || t('发送失败', 'Send failed');
    showToast(msg);
  } finally {
    sendingSmsCode.value = false;
  }
};

const handleRegister = async () => {
  if (registerDisabled.value) {
    showToast(registerDisabledText.value);
    return;
  }
  if (registerMode.value === 'phone') {
    if (!form.phone || !form.smsCode || !form.password) {
      showToast(t('请填写手机号、验证码和密码', 'Please fill in phone, code and password'));
      return;
    }
    if (!/^1\d{10}$/.test(form.phone)) {
      showToast(t('手机号格式不正确', 'Invalid phone number format'));
      return;
    }
    if (form.password.length < 6) {
      showToast(t('密码至少6位', 'Password must be at least 6 characters'));
      return;
    }
  } else {
    if (!form.username || !form.password || !form.email || !form.code) {
      showToast(t('请填写完整信息', 'Please fill in all fields'));
      return;
    }
    if (form.password.length < 6) {
      showToast(t('密码至少6位', 'Password must be at least 6 characters'));
      return;
    }
  }
  loading.value = true;
  try {
    const payload = registerMode.value === 'phone'
      ? { phone: form.phone, smsCode: form.smsCode, password: form.password, nickname: form.nickname }
      : form;
    const res = await authApi.register(payload);
    const d = res.data || res;
    userStore.setAuth(d.token, d.user);
    showToast(t('register.registerOk'));
    router.replace('/');
  } catch (err) {
    showToast(err.message || t('register.registerFailed'));
  } finally {
    loading.value = false;
  }
};

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  if (smsTimer) clearInterval(smsTimer);
});
</script>

<style scoped>
.register-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.register-header {
  text-align: center;
  padding: 30px 20px 16px;
}

.register-logo-img {
  width: 80px;
  height: auto;
  margin: 0 auto 12px;
  display: block;
  object-fit: contain;
}

.register-logo {
  width: 80px;
  margin: 0 auto 12px;
}

.register-header h2 {
  font-size: 20px;
  color: var(--vino-text);
}

.register-form {
  padding: 16px 0;
}

.register-actions {
  padding: 24px 16px;
}

.login-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--vino-text-secondary);
}

.login-link span {
  color: var(--vino-primary);
  cursor: pointer;
}
</style>
