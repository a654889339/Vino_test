import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/products',
    name: 'Products',
    component: () => import('@/views/Products.vue'),
  },
  {
    path: '/services',
    name: 'Services',
    component: () => import('@/views/Services.vue'),
  },
  {
    path: '/service/:id/book',
    name: 'ServiceBook',
    component: () => import('@/views/ServiceBook.vue'),
  },
  {
    path: '/service/:id',
    name: 'ServiceDetail',
    component: () => import('@/views/ServiceDetail.vue'),
  },
  {
    path: '/guide/:id/manual',
    name: 'ManualPage',
    component: () => import('@/views/ManualPage.vue'),
  },
  {
    path: '/guide/:id/maintenance',
    name: 'MaintenancePage',
    component: () => import('@/views/MaintenancePage.vue'),
  },
  {
    path: '/guide/:id',
    name: 'GuideDetail',
    component: () => import('@/views/GuideDetail.vue'),
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
  },
  {
    path: '/cart',
    name: 'Cart',
    component: () => import('@/views/Cart.vue'),
  },
  {
    path: '/checkout',
    name: 'Checkout',
    component: () => import('@/views/Checkout.vue'),
  },
  {
    path: '/goods-orders',
    name: 'GoodsOrders',
    component: () => import('@/views/GoodsOrders.vue'),
  },
  {
    path: '/goods-orders/:id',
    name: 'GoodsOrderDetail',
    component: () => import('@/views/GoodsOrderDetail.vue'),
  },
  {
    path: '/mine',
    name: 'Mine',
    component: () => import('@/views/Mine.vue'),
  },
  {
    path: '/mine/profile',
    name: 'ProfileEdit',
    component: () => import('@/views/ProfileEdit.vue'),
  },
  {
    path: '/mine/products',
    name: 'MyProducts',
    component: () => import('@/views/MyProducts.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
  },
  {
    path: '/address',
    name: 'AddressList',
    component: () => import('@/views/AddressList.vue'),
  },
  {
    path: '/address/add',
    name: 'AddressAdd',
    component: () => import('@/views/AddressEdit.vue'),
  },
  {
    path: '/address/edit/:id',
    name: 'AddressEditDetail',
    component: () => import('@/views/AddressEdit.vue'),
  },
  {
    path: '/bind-product',
    name: 'BindProduct',
    component: () => import('@/views/BindProduct.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Vite 每次构建会重命名 assets/*.js 的哈希文件名。
// 浏览器若还持有已失效的哈希文件名，点击跳转会 404 并抛出：
//   "Failed to fetch dynamically imported module: .../assets/Xxx-<hash>.js"
// 这里捕获该错误并用硬刷新加载最新 index.html + 新哈希资源。
const RELOAD_FLAG_KEY = '__vino_chunk_reload_ts__';
router.onError((error, to) => {
  const msg = (error && error.message) || '';
  const isChunkLoadErr =
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w\-]+ failed/i.test(msg);
  if (!isChunkLoadErr) return;
  // 防止死循环：短时间内只强制刷新一次。
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOAD_FLAG_KEY) || 0); } catch (e) {}
  const now = Date.now();
  if (now - last < 10000) return;
  try { sessionStorage.setItem(RELOAD_FLAG_KEY, String(now)); } catch (e) {}
  const target = (to && to.fullPath) || window.location.pathname + window.location.search;
  window.location.replace(target);
});

export default router;
