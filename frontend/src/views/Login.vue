<template>
  <div class="login-page">
    <van-nav-bar title="登录" left-arrow @click-left="$router.back()" />

    <div class="login-header">
      <img src="https://itsyourturnmy-1256887166.cos.ap-singapore.myqcloud.com/vino/logo.svg" alt="Vino" class="login-logo" />
      <h2>欢迎使用 Vino 服务</h2>
    </div>

    <div class="login-form">
      <van-cell-group inset>
        <van-field
          v-model="form.username"
          label="账号"
          placeholder="请输入用户名"
          left-icon="manager-o"
        />
        <van-field
          v-model="form.password"
          type="password"
          label="密码"
          placeholder="请输入密码"
          left-icon="lock"
          autocomplete="current-password"
        />
      </van-cell-group>

      <div class="login-actions">
        <van-button
          type="primary"
          color="#B91C1C"
          block
          round
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </van-button>
        <p class="register-link">
          还没有账号？<span @click="handleRegister">立即注册</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { showToast } from 'vant';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(false);

const form = reactive({ username: '', password: '' });

const handleLogin = async () => {
  if (!form.username || !form.password) {
    showToast('请填写完整信息');
    return;
  }
  loading.value = true;
  try {
    await userStore.login(form);
    showToast('登录成功');
    router.replace('/');
  } catch (err) {
    showToast(err.message || '登录失败');
  } finally {
    loading.value = false;
  }
};

const handleRegister = () => {
  showToast('注册功能开发中');
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

.login-header h2 {
  font-size: 20px;
  color: var(--vino-text);
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
