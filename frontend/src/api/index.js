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

export const addressApi = {
  list: () => request.get('/addresses'),
  create: (data) => request.post('/addresses', data),
  update: (id, data) => request.put(`/addresses/${id}`, data),
  remove: (id) => request.delete(`/addresses/${id}`),
  setDefault: (id) => request.put(`/addresses/${id}/default`),
};
