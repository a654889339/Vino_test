import request from './request';

export const authApi = {
  login: (data) => request.post('/auth/login', data),
  register: (data) => request.post('/auth/register', data),
  getProfile: () => request.get('/auth/profile'),
};

export const serviceApi = {
  list: (params) => request.get('/services', { params }),
  detail: (id) => request.get(`/services/${id}`),
};
