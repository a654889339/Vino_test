import axios from 'axios';
import router from '@/router';

// baseURL 唯一入口：默认走 nginx 反代的 /api/outlet；部署差异可通过 VITE_API_BASE_OUTLET 覆盖。
// 禁止在业务代码里出现具体 host 字面量。
const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_OUTLET || '/api/outlet',
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('vino_outlet_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const { data } = response;
    if (data.code !== 0) {
      return Promise.reject(new Error(data.message || '请求失败'));
    }
    return data;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vino_outlet_token');
      router.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default request;
