const path = require('path');
const express = require('express');
const cors = require('cors');
const {
  getProducts,
  getSummary,
  getPendingUsage,
  registerUsage,
  registerEntrada,
  registerSaida,
  createOrderFromUsage,
  createOrderFromMinimum,
  receiveOrder,
  cancelOrder,
  updateOpenOrderItems,
  deleteOrder,
  listOrders,
  getOrder,
  listMovements,
  updateProductMinimum,
  getMonthlyUsageReport,
} = require('./db');
const {
  authStatus,
  setupAdmin,
  login,
  logout,
  getUserByToken,
  listUsers,
  createUser,
  updateUser,
} = require('./auth');
const { seed } = require('./seed');

seed();

const app = express();
const PORT = process.env.PORT || 3847;

app.use(cors());
app.use(express.json());

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.headers['x-auth-token'] || null;
}

function requireAuth(req, res, next) {
  const user = getUserByToken(getToken(req));
  if (!user) return res.status(401).json({ error: 'Faça login para continuar' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administrador' });
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/auth/status', (_req, res) => {
  res.json(authStatus());
});

app.post('/api/auth/setup', (req, res) => {
  try {
    const result = setupAdmin(req.body || {});
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const result = login(req.body || {});
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  logout(getToken(req));
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users', requireAuth, requireAdmin, (_req, res) => {
  res.json(listUsers());
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const user = createUser(req.body || {});
    res.json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const user = updateUser(Number(req.params.id), req.body || {});
    res.json({ ok: true, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/summary', requireAuth, (_req, res) => {
  res.json(getSummary());
});

app.get('/api/products', requireAuth, (req, res) => {
  res.json(getProducts({
    q: req.query.q || '',
    family: req.query.family || '',
    status: req.query.status || '',
  }));
});

app.patch('/api/products/:id/minimum', requireAuth, requireAdmin, (req, res) => {
  try {
    const minimum = Number(req.body.minimum);
    if (Number.isNaN(minimum) || minimum < 0) throw new Error('Mínimo inválido');
    res.json(updateProductMinimum(Number(req.params.id), minimum));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/usage/pending', requireAuth, requireAdmin, (req, res) => {
  res.json(getPendingUsage(req.query.clinic || undefined));
});

app.post('/api/usage', requireAuth, (req, res) => {
  try {
    let clinic = req.body.clinic;
    if (req.user.role === 'dentist') {
      clinic = req.user.clinic;
    }
    if (!clinic) throw new Error('Clínica obrigatória');
    const note = req.body.note
      || `Uso por ${req.user.name}${req.user.role === 'dentist' ? ` · ${clinic}` : ''}`;
    const created = registerUsage({
      clinic,
      items: req.body.items,
      note,
    });
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/entrada', requireAuth, requireAdmin, (req, res) => {
  try {
    const created = registerEntrada(req.body);
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/saida', requireAuth, requireAdmin, (req, res) => {
  try {
    const created = registerSaida(req.body);
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/orders', requireAuth, requireAdmin, (_req, res) => {
  res.json(listOrders());
});

app.get('/api/orders/:id', requireAuth, requireAdmin, (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Não encontrado' });
  res.json(order);
});

app.post('/api/orders/from-usage', requireAuth, requireAdmin, (req, res) => {
  try {
    const order = createOrderFromUsage(req.body.clinic);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/from-minimum', requireAuth, requireAdmin, (req, res) => {
  try {
    const order = createOrderFromMinimum(req.body.clinic);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/:id/receive', requireAuth, requireAdmin, (req, res) => {
  try {
    const order = receiveOrder(req.params.id, req.body || {});
    res.json({ ok: true, order, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/:id/cancel', requireAuth, requireAdmin, (req, res) => {
  try {
    const order = cancelOrder(req.params.id);
    res.json({ ok: true, order, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/orders/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const result = deleteOrder(req.params.id);
    res.json({ ok: true, ...result, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/items', requireAuth, requireAdmin, (req, res) => {
  try {
    const order = updateOpenOrderItems(req.params.id, req.body.items || []);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/movements', requireAuth, requireAdmin, (req, res) => {
  res.json(listMovements({ limit: Number(req.query.limit) || 50 }));
});

app.get('/api/reports/monthly-usage', requireAuth, (req, res) => {
  try {
    let clinic = req.query.clinic || undefined;
    if (req.user.role === 'dentist') clinic = req.user.clinic;
    res.json(getMonthlyUsageReport({
      year: req.query.year,
      month: req.query.month,
      clinic,
    }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API estoque-implantes em http://0.0.0.0:${PORT}`);
});
