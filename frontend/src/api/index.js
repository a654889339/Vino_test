import request from './request';

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  sendCode: (data) => request.post('/auth/send-code', data),
  register: (data) => request.post('/auth/register', data),
  getProfile: () => request.get('/auth/profile'),
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
  list: () => request.get('/guides'),
  detail: (id) => request.get(`/guides/${id}`),
};

// 聊天消息 API（用户端）
export const messageApi = {
  mine: () => request.get('/messages/mine'),       // 获取我的聊天记录
  send: (data) => request.post('/messages/send', data), // 发送消息给客服
  unread: () => request.get('/messages/unread'),   // 获取未读消息数（轮询用）
};

export const homeConfigApi = {
  list: () => request.get('/home-config'),
};

export const addressApi = {
  list: () => request.get('/addresses'),
  create: (data) => request.post('/addresses', data),
  update: (id, data) => request.put(`/addresses/${id}`, data),
  remove: (id) => request.delete(`/addresses/${id}`),
  setDefault: (id) => request.put(`/addresses/${id}/default`),
};
