const fs = require('fs');
const path = require('path');
const { db } = require('./db');

function seed() {
  const candidates = [
    process.env.DATA_DIR ? path.join(path.resolve(process.env.DATA_DIR), 'seed.json') : null,
    path.join(__dirname, '..', 'data', 'seed.json'),
  ].filter(Boolean);
  const seedPath = candidates.find((p) => fs.existsSync(p));
  if (!seedPath) throw new Error('seed.json não encontrado');
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  const existing = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (existing > 0) {
    console.log('Banco já possui produtos. Seed ignorado.');
    return;
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (code, name, family, quantity, minimum)
    VALUES (@code, @name, @family, @quantity, @minimum)
  `);
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, clinic, status, text, total_units, source, created_at)
    VALUES (@id, @clinic, 'historico', @text, @total_units, 'importado', @created_at)
  `);

  const tx = db.transaction(() => {
    for (const p of seed.products) insertProduct.run(p);
    for (const o of seed.orders) {
      const totalMatch = o.text.match(/TOTAL:\s*(\d+)/i);
      insertOrder.run({
        id: o.id,
        clinic: o.clinic || 'OC',
        text: o.text,
        total_units: totalMatch ? Number(totalMatch[1]) : 0,
        created_at: o.date,
      });
    }
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_at', ?)`).run(new Date().toISOString());
  });

  tx();
  console.log(`Seed OK: ${seed.products.length} produtos, ${seed.orders.length} pedidos.`);
}

if (require.main === module) seed();
module.exports = { seed };
