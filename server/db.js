const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
    : path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'estoque.db');
const seedSource = path.join(__dirname, '..', 'data', 'seed.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Keep seed.json available even when DATA_DIR / volume points elsewhere
const volumeOrDataDir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (volumeOrDataDir && !fs.existsSync(path.join(dataDir, 'seed.json')) && fs.existsSync(seedSource)) {
  fs.copyFileSync(seedSource, path.join(dataDir, 'seed.json'));
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    minimum INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    product_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('entrada','saida','uso','ajuste')),
    quantity INTEGER NOT NULL,
    clinic TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    order_id TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    clinic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    text TEXT NOT NULL,
    total_units INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'uso',
    created_at TEXT NOT NULL,
    received_at TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function productStatus(row) {
  const buy = Math.max(0, row.minimum - row.quantity);
  return {
    ...row,
    status: buy > 0 ? 'Comprar' : 'OK',
    buy,
  };
}

function getProducts({ q = '', family = '', status = '' } = {}) {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (family) {
    sql += ' AND family = ?';
    params.push(family);
  }
  sql += ' ORDER BY family, name';
  let rows = db.prepare(sql).all(...params).map(productStatus);
  if (status === 'Comprar') rows = rows.filter((r) => r.status === 'Comprar');
  if (status === 'OK') rows = rows.filter((r) => r.status === 'OK');
  return rows;
}

function getSummary() {
  const products = getProducts();
  const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
  const toBuy = products.filter((p) => p.status === 'Comprar');
  const pendingUsage = getPendingUsage();
  const pendingByClinic = {};
  for (const item of pendingUsage) {
    pendingByClinic[item.clinic] = pendingByClinic[item.clinic] || { units: 0, items: 0 };
    pendingByClinic[item.clinic].units += item.quantity;
    pendingByClinic[item.clinic].items += 1;
  }
  return {
    totalProducts: products.length,
    totalUnits,
    alerts: toBuy.length,
    buyUnits: toBuy.reduce((s, p) => s + p.buy, 0),
    pendingUsageUnits: pendingUsage.reduce((s, p) => s + p.quantity, 0),
    pendingByClinic,
  };
}

function getPendingUsage(clinic) {
  let sql = `
    SELECT m.clinic, m.product_id, p.code, p.name, p.family,
           SUM(m.quantity) as quantity
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.type = 'uso' AND m.order_id IS NULL
  `;
  const params = [];
  if (clinic) {
    sql += ' AND m.clinic = ?';
    params.push(clinic);
  }
  sql += ' GROUP BY m.clinic, m.product_id ORDER BY m.clinic, p.family, p.name';
  return db.prepare(sql).all(...params).map((r) => ({
    ...r,
    quantity: Number(r.quantity),
  }));
}

function applyStockChange(productId, delta) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Produto não encontrado');
  const next = product.quantity + delta;
  if (next < 0) throw new Error(`Estoque insuficiente para ${product.code}`);
  db.prepare('UPDATE products SET quantity = ? WHERE id = ?').run(next, productId);
  return db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
}

function createMovement({ id, productId, type, quantity, clinic = null, note = null, createdAt = new Date().toISOString(), orderId = null }) {
  db.prepare(`
    INSERT INTO movements (id, product_id, type, quantity, clinic, note, created_at, order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, productId, type, quantity, clinic, note, createdAt, orderId);
}

function registerUsage({ clinic, items, note }) {
  if (!clinic) throw new Error('Clínica obrigatória');
  if (!items?.length) throw new Error('Informe ao menos um item');

  const tx = db.transaction(() => {
    const created = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty < 1) continue;
      const product = item.productId
        ? db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId)
        : db.prepare('SELECT * FROM products WHERE code = ?').get(item.code);
      if (!product) throw new Error(`Produto inválido: ${item.code || item.productId}`);
      applyStockChange(product.id, -qty);
      const id = require('crypto').randomUUID().slice(0, 8);
      createMovement({
        id,
        productId: product.id,
        type: 'uso',
        quantity: qty,
        clinic,
        note: note || null,
      });
      created.push({ id, productId: product.id, code: product.code, quantity: qty });
    }
    if (!created.length) throw new Error('Nenhuma quantidade válida');
    return created;
  });

  return tx();
}

function registerEntrada({ items, note, clinic = null }) {
  if (!items?.length) throw new Error('Informe ao menos um item');
  const tx = db.transaction(() => {
    const created = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty < 1) continue;
      const product = item.productId
        ? db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId)
        : db.prepare('SELECT * FROM products WHERE code = ?').get(item.code);
      if (!product) throw new Error(`Produto inválido`);
      applyStockChange(product.id, qty);
      const id = require('crypto').randomUUID().slice(0, 8);
      createMovement({
        id,
        productId: product.id,
        type: 'entrada',
        quantity: qty,
        clinic,
        note: note || null,
      });
      created.push({ id, code: product.code, quantity: qty });
    }
    if (!created.length) throw new Error('Nenhuma quantidade válida');
    return created;
  });
  return tx();
}

function registerSaida({ items, note }) {
  if (!items?.length) throw new Error('Informe ao menos um item');
  const tx = db.transaction(() => {
    const created = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!qty || qty < 1) continue;
      const product = item.productId
        ? db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId)
        : db.prepare('SELECT * FROM products WHERE code = ?').get(item.code);
      if (!product) throw new Error('Produto inválido');
      applyStockChange(product.id, -qty);
      const id = require('crypto').randomUUID().slice(0, 8);
      createMovement({
        id,
        productId: product.id,
        type: 'saida',
        quantity: qty,
        note: note || null,
      });
      created.push({ id, code: product.code, quantity: qty });
    }
    if (!created.length) throw new Error('Nenhuma quantidade válida');
    return created;
  });
  return tx();
}

function formatOrderText(clinic, items) {
  const lines = items.map((i) => {
    const unit = i.quantity === 1 ? 'unidade' : 'unidades';
    return `Cod. ${i.code} - ${i.name} → ${i.quantity} ${unit}`;
  });
  const total = items.reduce((s, i) => s + i.quantity, 0);
  const unit = total === 1 ? 'unidade' : 'unidades';
  return `Pedido de reposição (${clinic}):\n\n${lines.join('\n')}\n\nTOTAL: ${total} ${unit}`;
}

function createOrderFromUsage(clinic) {
  if (!clinic) throw new Error('Clínica obrigatória');
  const pending = getPendingUsage(clinic);
  if (!pending.length) throw new Error(`Nenhum uso pendente para ${clinic}`);

  const tx = db.transaction(() => {
    const id = require('crypto').randomUUID().slice(0, 8);
    const createdAt = new Date().toISOString();
    const total = pending.reduce((s, i) => s + i.quantity, 0);
    const text = formatOrderText(clinic, pending);
    db.prepare(`
      INSERT INTO orders (id, clinic, status, text, total_units, source, created_at)
      VALUES (?, ?, 'aberto', ?, ?, 'uso', ?)
    `).run(id, clinic, text, total, createdAt);

    for (const item of pending) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity)
        VALUES (?, ?, ?)
      `).run(id, item.product_id, item.quantity);
    }

    db.prepare(`
      UPDATE movements
      SET order_id = ?
      WHERE type = 'uso' AND clinic = ? AND order_id IS NULL
    `).run(id, clinic);

    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  });

  return tx();
}

function createOrderFromMinimum(clinic) {
  if (!clinic) throw new Error('Clínica obrigatória');
  const toBuy = getProducts().filter((p) => p.buy > 0);
  if (!toBuy.length) throw new Error('Nenhum item abaixo do mínimo');

  const items = toBuy.map((p) => ({
    product_id: p.id,
    code: p.code,
    name: p.name,
    quantity: p.buy,
  }));

  const tx = db.transaction(() => {
    const id = require('crypto').randomUUID().slice(0, 8);
    const createdAt = new Date().toISOString();
    const total = items.reduce((s, i) => s + i.quantity, 0);
    const text = formatOrderText(clinic, items);
    db.prepare(`
      INSERT INTO orders (id, clinic, status, text, total_units, source, created_at)
      VALUES (?, ?, 'aberto', ?, ?, 'minimo', ?)
    `).run(id, clinic, text, total, createdAt);
    for (const item of items) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity)
        VALUES (?, ?, ?)
      `).run(id, item.product_id, item.quantity);
    }
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  });
  return tx();
}

function receiveOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Pedido não encontrado');
  if (order.status === 'recebido') throw new Error('Pedido já recebido');

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const tx = db.transaction(() => {
    for (const item of items) {
      applyStockChange(item.product_id, item.quantity);
      const id = require('crypto').randomUUID().slice(0, 8);
      createMovement({
        id,
        productId: item.product_id,
        type: 'entrada',
        quantity: item.quantity,
        clinic: order.clinic,
        note: `Recebimento pedido ${orderId}`,
        orderId,
      });
    }
    const receivedAt = new Date().toISOString();
    db.prepare(`UPDATE orders SET status = 'recebido', received_at = ? WHERE id = ?`).run(receivedAt, orderId);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });
  return tx();
}

function listOrders() {
  return db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
}

function getOrder(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  const items = db.prepare(`
    SELECT oi.*, p.code, p.name, p.family
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(id);
  return { ...order, items };
}

function listMovements({ limit = 50 } = {}) {
  return db.prepare(`
    SELECT m.*, p.code, p.name, p.family
    FROM movements m
    JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(limit);
}

function updateProductMinimum(id, minimum) {
  db.prepare('UPDATE products SET minimum = ? WHERE id = ?').run(minimum, id);
  return productStatus(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) throw new Error('Mês inválido');
  const start = `${y}-${pad2(m)}-01T00:00:00.000Z`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${pad2(nextM)}-01T00:00:00.000Z`;
  return { start, end, year: y, month: m };
}

function listReportMonths() {
  const rows = db.prepare(`
    SELECT DISTINCT substr(created_at, 1, 7) AS ym
    FROM movements
    WHERE type = 'uso'
    ORDER BY ym DESC
  `).all();
  const months = rows.map((r) => {
    const [year, month] = r.ym.split('-').map(Number);
    return { year, month, key: r.ym };
  });
  const now = new Date();
  const current = {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    key: `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`,
  };
  if (!months.some((m) => m.key === current.key)) {
    months.unshift(current);
  }
  return months;
}

function getMonthlyUsageReport({ year, month, clinic } = {}) {
  const now = new Date();
  const y = Number(year) || now.getUTCFullYear();
  const m = Number(month) || (now.getUTCMonth() + 1);
  const { start, end } = monthBounds(y, m);

  let sql = `
    SELECT m.clinic, m.product_id, p.code, p.name, p.family,
           SUM(m.quantity) AS quantity,
           COUNT(*) AS events
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.type = 'uso'
      AND m.created_at >= ?
      AND m.created_at < ?
  `;
  const params = [start, end];
  if (clinic) {
    sql += ' AND m.clinic = ?';
    params.push(clinic);
  }
  sql += ' GROUP BY m.clinic, m.product_id ORDER BY m.clinic, quantity DESC, p.name';

  const items = db.prepare(sql).all(...params).map((r) => ({
    ...r,
    quantity: Number(r.quantity),
    events: Number(r.events),
  }));

  const byClinic = {};
  for (const item of items) {
    if (!byClinic[item.clinic]) {
      byClinic[item.clinic] = {
        clinic: item.clinic,
        totalUnits: 0,
        totalEvents: 0,
        byFamily: {},
        items: [],
      };
    }
    const c = byClinic[item.clinic];
    c.totalUnits += item.quantity;
    c.totalEvents += item.events;
    c.byFamily[item.family] = (c.byFamily[item.family] || 0) + item.quantity;
    c.items.push(item);
  }

  const clinics = Object.values(byClinic).sort((a, b) => a.clinic.localeCompare(b.clinic));
  const totalUnits = clinics.reduce((s, c) => s + c.totalUnits, 0);

  const daily = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, clinic, SUM(quantity) AS quantity
    FROM movements
    WHERE type = 'uso'
      AND created_at >= ?
      AND created_at < ?
      ${clinic ? 'AND clinic = ?' : ''}
    GROUP BY day, clinic
    ORDER BY day
  `).all(...(clinic ? [start, end, clinic] : [start, end]))
    .map((r) => ({ ...r, quantity: Number(r.quantity) }));

  return {
    year: y,
    month: m,
    key: `${y}-${pad2(m)}`,
    label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    clinic: clinic || null,
    totalUnits,
    clinics,
    daily,
    months: listReportMonths(),
  };
}

module.exports = {
  db,
  getProducts,
  getSummary,
  getPendingUsage,
  registerUsage,
  registerEntrada,
  registerSaida,
  createOrderFromUsage,
  createOrderFromMinimum,
  receiveOrder,
  listOrders,
  getOrder,
  listMovements,
  updateProductMinimum,
  getMonthlyUsageReport,
  listReportMonths,
  productStatus,
};
