const crypto = require('crypto');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','dentist')),
    clinic TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const next = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
  } catch {
    return false;
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    clinic: row.clinic || null,
    active: !!row.active,
    created_at: row.created_at,
  };
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY role, name').all().map(publicUser);
}

function getUserById(id) {
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

function createUser({ name, username, password, role, clinic }) {
  if (!name?.trim()) throw new Error('Nome obrigatório');
  if (!username?.trim()) throw new Error('Usuário (login) obrigatório');
  if (!password || String(password).length < 4) throw new Error('Senha com pelo menos 4 caracteres');
  if (!['admin', 'dentist'].includes(role)) throw new Error('Perfil inválido');
  if (role === 'dentist' && !clinic) throw new Error('Clínica obrigatória para dentista');

  const existing = db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username.trim());
  if (existing) throw new Error('Este login já existe');

  const createdAt = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO users (name, username, password_hash, role, clinic, active, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(
    name.trim(),
    username.trim().toLowerCase(),
    hashPassword(password),
    role,
    role === 'dentist' ? clinic : null,
    createdAt,
  );
  return getUserById(info.lastInsertRowid);
}

function updateUser(id, { name, username, clinic, password, active, role }) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) throw new Error('Usuário não encontrado');

  const nextName = name !== undefined ? String(name).trim() : row.name;
  const nextUsername = username !== undefined
    ? String(username).trim().toLowerCase()
    : row.username;
  const nextRole = role !== undefined ? role : row.role;
  const nextClinic = nextRole === 'dentist'
    ? (clinic !== undefined ? clinic : row.clinic)
    : null;
  const nextActive = active !== undefined ? (active ? 1 : 0) : row.active;
  if (!nextName) throw new Error('Nome obrigatório');
  if (!nextUsername) throw new Error('Login obrigatório');
  if (nextRole === 'dentist' && !nextClinic) throw new Error('Clínica obrigatória para dentista');

  if (nextUsername !== row.username) {
    const taken = db.prepare(
      'SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?',
    ).get(nextUsername, id);
    if (taken) throw new Error('Este login já existe');
  }

  let passwordHash = row.password_hash;
  if (password !== undefined && password !== '') {
    if (String(password).length < 4) throw new Error('Senha com pelo menos 4 caracteres');
    passwordHash = hashPassword(password);
  }

  db.prepare(`
    UPDATE users
    SET name = ?, username = ?, role = ?, clinic = ?, active = ?, password_hash = ?
    WHERE id = ?
  `).run(nextName, nextUsername, nextRole, nextClinic, nextActive, passwordHash, id);

  return getUserById(id);
}

function createSession(userId, days = 30) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date().toISOString();
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(token, userId, createdAt, expires);
  return token;
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getUserByToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.*, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  if (!row.active) return null;
  return publicUser(row);
}

function login({ username, password }) {
  if (!username || !password) throw new Error('Informe usuário e senha');
  const row = db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(String(username).trim());
  if (!row || !row.active) throw new Error('Usuário ou senha inválidos');
  if (!verifyPassword(password, row.password_hash)) throw new Error('Usuário ou senha inválidos');
  const token = createSession(row.id);
  return { token, user: publicUser(row) };
}

function setupAdmin({ name, username, password }) {
  if (countUsers() > 0) throw new Error('Sistema já configurado');
  const user = createUser({
    name: name || 'Administrador',
    username: username || 'admin',
    password,
    role: 'admin',
    clinic: null,
  });
  const token = createSession(user.id);
  return { token, user };
}

function authStatus() {
  return {
    configured: countUsers() > 0,
    clinics: ['OC', 'RO'],
  };
}

module.exports = {
  authStatus,
  setupAdmin,
  login,
  logout: destroySession,
  getUserByToken,
  listUsers,
  createUser,
  updateUser,
  getUserById,
  countUsers,
};
