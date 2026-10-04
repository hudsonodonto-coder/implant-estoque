const base = '';
const TOKEN_KEY = 'impla_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error(data.error || 'Faça login para continuar');
    err.code = 401;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || 'Falha na requisição');
  return data;
}

export const api = {
  authStatus: () => request('/api/auth/status'),
  setup: (body) => request('/api/auth/setup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: '{}' }),
  me: () => request('/api/auth/me'),
  users: () => request('/api/users'),
  createUser: (body) => request('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) => request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  summary: () => request('/api/summary'),
  products: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/api/products?${q}`);
  },
  pendingUsage: (clinic) => request(`/api/usage/pending${clinic ? `?clinic=${clinic}` : ''}`),
  registerUsage: (body) => request('/api/usage', { method: 'POST', body: JSON.stringify(body) }),
  deleteUsage: (id) => request(`/api/usage/${id}`, { method: 'DELETE' }),
  entrada: (body) => request('/api/entrada', { method: 'POST', body: JSON.stringify(body) }),
  saida: (body) => request('/api/saida', { method: 'POST', body: JSON.stringify(body) }),
  orders: () => request('/api/orders'),
  order: (id) => request(`/api/orders/${id}`),
  orderFromUsage: (clinic) => request('/api/orders/from-usage', { method: 'POST', body: JSON.stringify({ clinic }) }),
  orderFromMinimum: (clinic) => request('/api/orders/from-minimum', { method: 'POST', body: JSON.stringify({ clinic }) }),
  updateMinimum: (id, minimum) => request(`/api/products/${id}/minimum`, {
    method: 'PATCH',
    body: JSON.stringify({ minimum }),
  }),
  receiveOrder: (id, body = {}) => request(`/api/orders/${id}/receive`, { method: 'POST', body: JSON.stringify(body) }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'POST', body: '{}' }),
  deleteOrder: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),
  updateOrderItems: (id, items) => request(`/api/orders/${id}/items`, { method: 'PATCH', body: JSON.stringify({ items }) }),
  movements: () => request('/api/movements'),
  monthlyUsage: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.set(k, v);
    });
    return request(`/api/reports/monthly-usage?${q}`);
  },
};
