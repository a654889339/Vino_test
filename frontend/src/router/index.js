import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/services',
    name: 'Services',
    component: () => import('@/views/Services.vue'),
  },
  {
    path: '/service/:id',
    name: 'ServiceDetail',
    component: () => import('@/views/ServiceDetail.vue'),
  },
  {
    path: '/orders',
    name: 'Orders',
    component: () => import('@/views/Orders.vue'),
  },
  {
    path: '/mine',
    name: 'Mine',
    component: () => import('@/views/Mine.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
