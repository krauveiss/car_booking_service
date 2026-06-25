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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

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

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');

  return `${salt}:${hash}`;
}

app.post('/api/auth/register', (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (username.length <= 3) {
    return res.status(400).json({ message: 'Username must be longer than 3 characters' });
  }

  if (password.length <= 6) {
    return res.status(400).json({ message: 'Password must be longer than 6 characters' });
  }

  try {
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [
      username,
      hashPassword(password)
    ]);

    const row = db.exec('SELECT last_insert_rowid() AS id')[0].values[0];
    const user = {
      id: Number(row[0]),
      username
    };
    const token = signJwt(user);

    saveDb();

    return res.status(201).json({ ...user, token });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend is running on http://localhost:${port}`);
});
