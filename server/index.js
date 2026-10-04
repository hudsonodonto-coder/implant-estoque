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
  listOrders,
  getOrder,
  listMovements,
  updateProductMinimum,
  getMonthlyUsageReport,
} = require('./db');
const { seed } = require('./seed');

seed();

const app = express();
const PORT = process.env.PORT || 3847;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/summary', (_req, res) => {
  res.json(getSummary());
});

app.get('/api/products', (req, res) => {
  res.json(getProducts({
    q: req.query.q || '',
    family: req.query.family || '',
    status: req.query.status || '',
  }));
});

app.patch('/api/products/:id/minimum', (req, res) => {
  try {
    const minimum = Number(req.body.minimum);
    if (Number.isNaN(minimum) || minimum < 0) throw new Error('Mínimo inválido');
    res.json(updateProductMinimum(Number(req.params.id), minimum));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/usage/pending', (req, res) => {
  res.json(getPendingUsage(req.query.clinic || undefined));
});

app.post('/api/usage', (req, res) => {
  try {
    const created = registerUsage(req.body);
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/entrada', (req, res) => {
  try {
    const created = registerEntrada(req.body);
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/saida', (req, res) => {
  try {
    const created = registerSaida(req.body);
    res.json({ ok: true, created, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/orders', (_req, res) => {
  res.json(listOrders());
});

app.get('/api/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Não encontrado' });
  res.json(order);
});

app.post('/api/orders/from-usage', (req, res) => {
  try {
    const order = createOrderFromUsage(req.body.clinic);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/from-minimum', (req, res) => {
  try {
    const order = createOrderFromMinimum(req.body.clinic);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/:id/receive', (req, res) => {
  try {
    const order = receiveOrder(req.params.id, req.body || {});
    res.json({ ok: true, order, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/orders/:id/cancel', (req, res) => {
  try {
    const order = cancelOrder(req.params.id);
    res.json({ ok: true, order, summary: getSummary() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/orders/:id/items', (req, res) => {
  try {
    const order = updateOpenOrderItems(req.params.id, req.body.items || []);
    res.json({ ok: true, order });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/movements', (req, res) => {
  res.json(listMovements({ limit: Number(req.query.limit) || 50 }));
});

app.get('/api/reports/monthly-usage', (req, res) => {
  try {
    res.json(getMonthlyUsageReport({
      year: req.query.year,
      month: req.query.month,
      clinic: req.query.clinic || undefined,
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
