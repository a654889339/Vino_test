import request from './request';

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  sendCode: (data) => request.post('/auth/send-code', data),
  sendSmsCode: (data) => request.post('/auth/send-sms-code', data),
  register: (data) => request.post('/auth/register', data),
  getProfile: () => request.get('/auth/profile'),
  updateProfile: (data) => request.put('/auth/profile', data),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return request.post('/auth/upload-avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  bindPhone: (data) => request.post('/auth/bind-phone', data),
  unbindPhone: (data) => request.post('/auth/unbind-phone', data),
  myProducts: () => request.get('/auth/my-products'),
  bindProduct: (data) => request.post('/auth/bind-product', data),
  bindByQrImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request.post('/auth/bind-by-qr-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const serviceApi = {
  list: (params) => request.get('/services', { params }),
  detail: (id) => request.get(`/services/${id}`),
};

export const orderApi = {
  create: (data) => request.post('/orders', data),
  mine: (params) => request.get('/orders/mine', { params }),
  detail: (id) => request.get(`/orders/${id}`),
  cancel: (id) => request.put(`/orders/${id}/cancel`),
};

export const guideApi = {
  categories: () => request.get('/guides/categories'),
  list: (params) => request.get('/guides', { params }),
  detail: (id) => request.get(`/guides/${id}`),
};

// 聊天消息 API（用户端）
export const messageApi = {
  mine: () => request.get('/messages/mine'),
  send: (data) => request.post('/messages/send', data),
  unread: () => request.get('/messages/unread'),
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append('image', file);
    return request.post('/messages/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const homeConfigApi = {
  list: (params) => request.get('/home-config', { params }),
  tabbar: () => request.get('/home-config', { params: { section: 'tabbar' } }),
};

export const addressApi = {
  list: () => request.get('/addresses'),
  create: (data) => request.post('/addresses', data),
  update: (id, data) => request.put(`/addresses/${id}`, data),
  remove: (id) => request.delete(`/addresses/${id}`),
  setDefault: (id) => request.put(`/addresses/${id}/default`),
};

// 商品购物车 / 商品订单
export const cartApi = {
  get: () => request.get('/cart'),
  put: (data) => request.put('/cart', data),
};

export const goodsOrderApi = {
  checkout: (data) => request.post('/goods-orders/checkout', data),
  list: (params) => request.get('/goods-orders', { params }),
  detail: (id) => request.get(`/goods-orders/${id}`),
  payWechat: (id) => request.post(`/goods-orders/${id}/pay-wechat`),
  cancel: (id) => request.post(`/goods-orders/${id}/cancel`),
};

/** 与 admin.html 同源：后端 embed 的媒体桶规则 JSON。需管理员 JWT，普通用户会 403。 */
export const mediaAssetCatalogApi = {
  get: () => request.get('/admin/media-asset-catalog'),
};
