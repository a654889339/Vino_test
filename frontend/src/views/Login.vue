<template>
  <div class="login-page">
    <van-nav-bar :title="t('login.title')" left-arrow @click-left="$router.back()" />

    <div class="login-header">
      <img
        v-if="brandLogoUrl && !brandLogoError"
        :src="brandLogoUrl"
        alt="VINO"
        class="login-logo-img"
        @error="brandLogoError = true"
      />
      <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 200" class="login-logo">
        <path d="M18 35 L58 35 L100 145 L142 35 L160 35 L108 170 L92 170 Z" fill="#B91C1C"/>
        <path d="M165 35 L195 35 L195 170 L165 170 Z" fill="#B91C1C"/>
        <path d="M210 35 L240 35 L320 140 L320 35 L350 35 L350 170 L320 170 L240 65 L240 170 L210 170 Z" fill="#B91C1C"/>
        <circle cx="420" cy="102" r="68" stroke="#B91C1C" stroke-width="28" fill="none"/>
        <path d="M405 72 C410 58, 435 55, 440 72 C445 89, 420 98, 415 112 C410 126, 430 138, 445 125 C435 145, 405 138, 400 120 C395 102, 418 95, 425 80 C430 70, 412 65, 408 75Z" fill="#B91C1C"/>
        <circle cx="498" cy="38" r="10" stroke="#999" stroke-width="1.5" fill="none"/>
        <text x="498" y="43" font-family="Arial" font-size="14" fill="#999" text-anchor="middle" font-weight="bold">R</text>
      </svg>
      <h2>{{ splashDesc || t('login.welcome') }}</h2>
      <!-- 登录页下方：显示后台 首页配置-首页logo-描述 -->
      <p v-if="headerLogoDesc" class="login-header-desc">{{ headerLogoDesc }}</p>
    </div>

    <div class="login-form">
      <van-tabs v-model:active="loginMode" class="login-tabs">
        <van-tab :title="t('login.tabAccount')" name="account">
          <van-cell-group inset>
            <van-field
              v-model="form.username"
              :label="t('login.account')"
              :placeholder="t('login.usernamePh')"
              left-icon="manager-o"
            />
            <van-field
              v-model="form.password"
              type="password"
              :label="t('login.password')"
              :placeholder="t('login.passwordPh')"
              left-icon="lock"
              autocomplete="current-password"
            />
          </van-cell-group>
        </van-tab>
        <van-tab :title="t('login.tabPhone')" name="phone">
          <van-cell-group inset>
            <van-field
              v-model="form.phone"
              :label="t('login.phone')"
              :placeholder="t('login.phonePh')"
              left-icon="phone-o"
              type="tel"
              maxlength="11"
            />
            <van-field
              v-model="form.smsCode"
              :label="t('login.smsCode')"
              :placeholder="t('login.smsCodePh')"
              left-icon="shield-o"
              maxlength="6"
            >
              <template #button>
                <van-button
                  size="small"
                  type="primary"
                  color="#B91C1C"
                  :disabled="countdown > 0 || sendingCode"
                  :loading="sendingCode"
                  @click="handleSendSmsCode"
                >
                  {{ countdown > 0 ? countdown + 's' : t('login.sendSms') }}
                </van-button>
              </template>
            </van-field>
          </van-cell-group>
        </van-tab>
      </van-tabs>

      <div class="login-actions">
        <van-button
          type="primary"
          color="#B91C1C"
          block
          round
          :loading="loading"
          @click="handleLogin"
        >
          {{ t('login.submit') }}
        </van-button>
        <p class="register-link">
          {{ t('login.noAccount') }}<span @click="handleRegister">{{ t('login.registerLink') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { showToast } from 'vant';
import { homeConfigApi, authApi } from '@/api';
import { pick, t, isEn } from '@/utils/i18n';
import { frontPageLogoUrl } from '@/utils/cosMedia.js';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const loading = ref(false);
const splashDesc = ref('');
const brandLogoError = ref(false);
const headerLogoDesc = ref('');

const brandLogoUrl = computed(() => frontPageLogoUrl(isEn.value ? 'en' : 'zh'));

watch(isEn, () => {
  brandLogoError.value = false;
});

onMounted(async () => {
  try {
    const res = await homeConfigApi.list();
    const items = res.data || [];
    const splash = items.find(i => i.section === 'splash' && i.status === 'active');
    if (splash) {
      if (splash.desc) splashDesc.value = splash.desc;
    }
    const headerLogo = items.find(i => i.section === 'headerLogo' && i.status === 'active');
    if (headerLogo && headerLogo.desc) headerLogoDesc.value = headerLogo.desc;
  } catch (_) {}
});

const loginMode = ref('account');
const form = reactive({ username: '', password: '', phone: '', smsCode: '' });
const countdown = ref(0);
const sendingCode = ref(false);
let countdownTimer = null;

const handleSendSmsCode = async () => {
  if (!/^1\d{10}$/.test(form.phone)) {
    showToast(t('请输入正确的11位手机号', 'Please enter a valid 11-digit phone number'));
    return;
  }
  sendingCode.value = true;
  try {
    await authApi.sendSmsCode({ phone: form.phone });
    showToast(t('验证码已发送', 'Verification code sent'));
    countdown.value = 60;
    countdownTimer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) clearInterval(countdownTimer);
    }, 1000);
  } catch (err) {
    showToast(err.message || t('发送失败', 'Send failed'));
  } finally {
    sendingCode.value = false;
  }
};

const handleLogin = async () => {
  if (loginMode.value === 'phone') {
    if (!form.phone || !form.smsCode) {
      showToast(t('请填写手机号和验证码', 'Please enter phone number and verification code'));
      return;
    }
    if (!/^1\d{10}$/.test(form.phone)) {
      showToast(t('手机号格式不正确', 'Invalid phone number format'));
      return;
    }
  } else {
    if (!form.username || !form.password) {
      showToast(t('请填写完整信息', 'Please fill in all fields'));
      return;
    }
  }
  loading.value = true;
  try {
    const payload = loginMode.value === 'phone'
      ? { phone: form.phone, code: form.smsCode }
      : { username: form.username, password: form.password };
    await userStore.login(payload);
    showToast(t('login.loginOk'));
    const redirect = route.query.redirect;
    if (redirect && typeof redirect === 'string' && redirect.startsWith('/')) {
      router.replace(decodeURIComponent(redirect));
    } else {
      router.replace('/');
    }
  } catch (err) {
    showToast(err.message || t('login.loginFailed'));
  } finally {
    loading.value = false;
  }
};

const handleRegister = () => {
  router.push('/register');
};
</script>

<style scoped>
.login-page {
  background: var(--vino-bg);
  min-height: 100vh;
}

.login-header {
  text-align: center;
  padding: 40px 20px 20px;
}

.login-logo {
  width: 100px;
  margin: 0 auto 16px;
}

.login-logo-img {
  width: 120px;
  max-height: 80px;
  object-fit: contain;
  margin: 0 auto 16px;
  display: block;
}

.login-header h2 {
  font-size: 20px;
  color: var(--vino-text);
}

.login-header-desc {
  font-size: 14px;
  color: var(--vino-text-secondary);
  margin-top: 12px;
  line-height: 1.5;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}

.login-form {
  padding: 20px 0;
}

.login-actions {
  padding: 24px 16px;
}

.register-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: var(--vino-text-secondary);
}

.register-link span {
  color: var(--vino-primary);
  cursor: pointer;
}
</style>
