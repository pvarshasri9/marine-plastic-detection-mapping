/**
 * Central API service layer.
 * Uses relative URLs — works whether served from FastAPI at :8000 or any other port.
 * No hard-coded localhost URLs.
 */

import axios from 'axios';

// Always use relative URLs so the app works from any origin.
// FastAPI serves the React build at the same origin as the API.
const api = axios.create({ baseURL: '/' });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────
export const authAPI = {
  register: (data: { name: string; email: string; password: string; confirm_password: string }) =>
    api.post('/api/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/api/auth/login', data).then(r => r.data),
  me: () => api.get('/api/auth/me').then(r => r.data),
  logout: () => api.post('/api/auth/logout').then(r => r.data),
};

// ─── Detections ────────────────────────────────────
export const detectionsAPI = {
  modelStatus: () => api.get('/api/detections/model-status').then(r => r.data),
  analyze: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/detections/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  save: (data: object) => api.post('/api/detections', data).then(r => r.data),
  list: (params?: object) => api.get('/api/detections', { params }).then(r => r.data),
  get: (id: number) => api.get(`/api/detections/${id}`).then(r => r.data),
  delete: (id: number) => api.delete(`/api/detections/${id}`),
};

// ─── Map ───────────────────────────────────────────
export const mapAPI = {
  detections: (params?: object) => api.get('/api/map/detections', { params }).then(r => r.data),
  heatmap: () => api.get('/api/map/heatmap').then(r => r.data),
};

// ─── Analytics ─────────────────────────────────────
export const analyticsAPI = {
  summary: () => api.get('/api/analytics/summary').then(r => r.data),
  categories: () => api.get('/api/analytics/categories').then(r => r.data),
  trends: () => api.get('/api/analytics/trends').then(r => r.data),
  locations: () => api.get('/api/analytics/locations').then(r => r.data),
};

// ─── Hotspots ──────────────────────────────────────
export const hotspotsAPI = {
  list: () => api.get('/api/hotspots').then(r => r.data),
  updateStatus: (data: {
    hotspot_key: string;
    location_name: string;
    center_lat?: number | null;
    center_lon?: number | null;
    status: string;
    notes?: string;
  }) => api.post('/api/hotspots/cleanup-status', data).then(r => r.data),
};

// ─── Reports ───────────────────────────────────────
export const reportsAPI = {
  download: (detectionId: number) =>
    api.get(`/api/reports/${detectionId}`, { responseType: 'blob' }).then(r => r.data),
};

// ─── Export ────────────────────────────────────────
export const exportAPI = {
  csv: () =>
    api.get('/api/export/detections.csv', { responseType: 'blob' }).then(r => r.data),
};

// ─── Demo Dataset ──────────────────────────────────
export const demoAPI = {
  load: () => api.post('/api/demo/load').then(r => r.data),
  clear: () => api.delete('/api/demo/clear').then(r => r.data),
};

// ─── Helpers ───────────────────────────────────────
/**
 * Convert an absolute server-side file path like
 *   C:\...\uploads\original\abc.jpg  OR  /app/uploads/original/abc.jpg
 * into a relative URL like  /uploads/original/abc.jpg
 * so the browser fetches it from the same origin (FastAPI at :8000).
 */
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('/api/') || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }
  const idx = normalized.indexOf('/uploads/');
  if (idx !== -1) return normalized.slice(idx);
  if (normalized.startsWith('uploads/')) return `/${normalized}`;
  if (normalized.startsWith('/')) return normalized;
  return `/${normalized}`;
};

export default api;
