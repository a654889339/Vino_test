import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import 'vant/lib/index.css';
import './assets/main.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
router.afterEach((to) => {
  const path = (to.fullPath || to.path || '').slice(0, 500);
  if (!path) return;
  fetch('/api/analytics/page-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, app: 'outlet' }),
  }).catch(() => {});
});
app.mount('#app');
