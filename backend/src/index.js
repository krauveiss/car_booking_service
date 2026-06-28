import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT) || 3000;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(rootDir, 'data');
const dbPath = join(dataDir, 'app.sqlite');

mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();
const db = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    accepted INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'Сотрудник',
    position TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.run("ALTER TABLE users ADD COLUMN accepted INTEGER NOT NULL DEFAULT 0");
  db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Сотрудник'");
  db.run("ALTER TABLE users ADD COLUMN position TEXT NOT NULL DEFAULT ''");
} catch (e) { }

saveDb();

app.use(cors());
app.use(express.json());

function saveDb() {
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + 60 * 60 * 24 };
  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = createHmac('sha256', jwtSecret).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

function verifyJwt(token) {
  try {
    const [headerB64, bodyB64, signature] = token.split('.');
    const unsignedToken = `${headerB64}.${bodyB64}`;
    const expectedSignature = createHmac('sha256', jwtSecret).update(unsignedToken).digest('base64url');

    if (signature !== expectedSignature) return null;

    const body = JSON.parse(Buffer.from(bodyB64, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (body.exp && now > body.exp) return null;

    return body;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = scryptSync(password, salt, 64).toString('hex');
  return hash === verifyHash;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const decoded = verifyJwt(token);
  if (!decoded) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

app.post('/api/auth/register', (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const position = typeof req.body.position === 'string' ? req.body.position.trim() : '';

  if (username.length <= 3) {
    return res.status(400).json({ message: 'Username must be longer than 3 characters' });
  }

  if (password.length <= 6) {
    return res.status(400).json({ message: 'Password must be longer than 6 characters' });
  }

  try {
    db.run('INSERT INTO users (username, password_hash, position) VALUES (?, ?, ?)', [
      username,
      hashPassword(password),
      position
    ]);

    const row = db.exec('SELECT last_insert_rowid() AS id')[0].values[0];
    const userId = Number(row[0]);

    const userPayload = { id: userId, username };
    const token = signJwt(userPayload);

    saveDb();

    return res.status(201).json({
      id: userId,
      username,
      accepted: false,
      role: 'Сотрудник',
      position,
      token
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const stmt = db.prepare('SELECT * FROM users WHERE username = $username');
  const user = stmt.getAsObject({ $username: username });
  stmt.free();

  if (!user.id || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = signJwt({ id: user.id, username: user.username });

  return res.json({
    id: user.id,
    username: user.username,
    accepted: Boolean(user.accepted),
    role: user.role,
    position: user.position,
    token
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const stmt = db.prepare('SELECT id, username, accepted, role, position, created_at FROM users WHERE id = $id');
  const user = stmt.getAsObject({ $id: req.user.id });
  stmt.free();

  if (!user.id) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({
    ...user,
    accepted: Boolean(user.accepted)
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend is running on http://localhost:${port}`);
});