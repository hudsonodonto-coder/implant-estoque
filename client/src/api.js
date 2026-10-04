const base = '';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha na requisição');
  return data;
}

export const api = {
  summary: () => request('/api/summary'),
  products: (params = {}) => {
    const q = new URLSearchParams(params);
    return request(`/api/products?${q}`);
  },
  pendingUsage: (clinic) => request(`/api/usage/pending${clinic ? `?clinic=${clinic}` : ''}`),
  registerUsage: (body) => request('/api/usage', { method: 'POST', body: JSON.stringify(body) }),
  entrada: (body) => request('/api/entrada', { method: 'POST', body: JSON.stringify(body) }),
  saida: (body) => request('/api/saida', { method: 'POST', body: JSON.stringify(body) }),
  orders: () => request('/api/orders'),
  order: (id) => request(`/api/orders/${id}`),
  orderFromUsage: (clinic) => request('/api/orders/from-usage', { method: 'POST', body: JSON.stringify({ clinic }) }),
  orderFromMinimum: (clinic) => request('/api/orders/from-minimum', { method: 'POST', body: JSON.stringify({ clinic }) }),
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
