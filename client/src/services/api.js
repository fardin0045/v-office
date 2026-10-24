import axios from 'axios';
import { storage, TOKEN_KEY } from '../lib/storage';

// Same-origin by default: Vite proxies /api in development and the API server serves the app in production.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const UNAUTHORIZED_EVENT = 'voffice:unauthorized';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

const tzOffset = () => new Date().getTimezoneOffset();

api.interceptors.request.use((config) => {
  const token = storage.get(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Day-based reports are computed in the viewer's timezone.
  if ((config.method || 'get').toLowerCase() === 'get') {
    config.params = { tzOffset: tzOffset(), ...config.params };
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isCredentialCheck = /\/auth\/(login|register)$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !isCredentialCheck && storage.get(TOKEN_KEY)) {
      // Session expired or revoked: let the auth layer sign the user out everywhere.
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (error?.request && !error.response) return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const deskAPI = {
  getAllDesks: () => api.get('/desks'),
  getDesk: (id) => api.get(`/desks/${encodeURIComponent(id)}`),
  assignDesk: (data) => api.post('/desks/assign', data),
  unassignDesk: (data) => api.post('/desks/unassign', data),
  toggleLock: (data) => api.post('/desks/lock', data),
};

export const workAPI = {
  startWork: (data) => api.post('/work/start', { ...data, tzOffset: tzOffset() }),
  endWork: (data) => api.post('/work/end', data || {}),
  getActiveSession: () => api.get('/work/active'),
  getHistory: (params) => api.get('/work/history', { params }),
  getStats: () => api.get('/work/stats'),
};

export const chatAPI = {
  getMessages: (before) => api.get('/chat/messages', { params: before ? { before } : {} }),
  getUnread: () => api.get('/chat/unread'),
  send: (data) => api.post('/chat/messages', data),
  remove: (id) => api.delete(`/chat/messages/${id}`),
  markRead: () => api.post('/chat/read'),
};

export const notificationAPI = {
  getFeed: () => api.get('/notifications'),
  markRead: () => api.post('/notifications/read'),
};

export const employeeAPI = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  getMonthActivity: (id, month) => api.get(`/employees/${id}/activity`, { params: { month } }),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
};

export const meetingAPI = {
  list: () => api.get('/meetings'),
  create: (data) => api.post('/meetings', data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  cancel: (id) => api.delete(`/meetings/${id}`),
  end: (id) => api.post(`/meetings/${id}/end`),
  join: (id) => api.post(`/meetings/${id}/join`),
  leave: (id) => api.post(`/meetings/${id}/leave`),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getAnalytics: () => api.get('/admin/analytics'),
  getSessions: (params) => api.get('/admin/sessions', { params }),
};

export default api;
