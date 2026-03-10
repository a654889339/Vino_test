import { defineStore } from 'pinia';
import { authApi } from '@/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('vino_token') || '',
    userInfo: null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
  },
  actions: {
    async login(data) {
      const res = await authApi.login(data);
      this.token = res.data.token;
      this.userInfo = res.data.user;
      localStorage.setItem('vino_token', res.data.token);
    },
    async fetchProfile() {
      const res = await authApi.getProfile();
      this.userInfo = res.data;
    },
    logout() {
      this.token = '';
      this.userInfo = null;
      localStorage.removeItem('vino_token');
    },
  },
});
