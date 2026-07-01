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

db.run(`
  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    registration_number TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    seats INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'free',
    reserved_by INTEGER,
    reserved_at TEXT,
    expires_at TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.run("ALTER TABLE users ADD COLUMN accepted INTEGER NOT NULL DEFAULT 0");
  db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Сотрудник'");
  db.run("ALTER TABLE users ADD COLUMN position TEXT NOT NULL DEFAULT ''");
} catch (e) { }

try {
  db.run("ALTER TABLE cars ADD COLUMN reserved_by INTEGER");
  db.run("ALTER TABLE cars ADD COLUMN reserved_at TEXT");
  db.run("ALTER TABLE cars ADD COLUMN expires_at TEXT");
  db.run("ALTER TABLE cars ADD COLUMN confirmed_at TEXT");
} catch (e) { }

const seededCars = db.exec("SELECT COUNT(*) AS count FROM cars")[0].values[0][0];
if (!seededCars) {
  db.run(`
    INSERT INTO cars (brand, model, registration_number, color, seats, purpose, status) VALUES
    ('Toyota', 'Camry', 'A123BC', 'Белый', 5, 'Офис', 'free'),
    ('Honda', 'Civic', 'B456DE', 'Черный', 5, 'Служебный', 'free'),
    ('Volkswagen', 'Passat', 'C789FG', 'Синий', 5, 'Командировка', 'blocked'),
    ('Hyundai', 'Elantra', 'D012HI', 'Красный', 5, 'Пассажиры', 'free'),
    ('Kia', 'Rio', 'E345JK', 'Серый', 4, 'Город', 'free')
  `);
}

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

function requireAccepted(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const stmt = db.prepare('SELECT accepted FROM users WHERE id = $id');
  const user = stmt.getAsObject({ $id: req.user.id });
  stmt.free();

  if (!Boolean(user.accepted)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  next();
}

function refreshExpiredReservations() {
  const now = new Date().toISOString();
  db.run(`
    UPDATE cars
    SET status = 'free', reserved_by = NULL, reserved_at = NULL, expires_at = NULL, updated_at = ?
    WHERE status = 'reserved' AND expires_at IS NOT NULL AND expires_at <= ?
  `, [now, now]);
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

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const stmt = db.prepare('SELECT role FROM users WHERE id = $id');
    const user = stmt.getAsObject({ $id: req.user.id });
    stmt.free();

    if (user.role !== requiredRole) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    next();
  };
}
app.get('/api/admin/users', authenticateToken, requireRole('Администратор'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 10);
  const offset = (page - 1) * limit;

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role : '';

  let whereClauses = ['1=1'];
  let params = {};

  if (search) {
    whereClauses.push('username LIKE $search');
    params['$search'] = `%${search}%`;
  }
  if (role) {
    whereClauses.push('role = $role');
    params['$role'] = role;
  }

  const whereSql = whereClauses.join(' AND ');


  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereSql}`);
  const totalCount = countStmt.getAsObject(params).total;
  countStmt.free();

  const dataStmt = db.prepare(`
    SELECT id, username, accepted, role, position, created_at 
    FROM users 
    WHERE ${whereSql}
    ORDER BY id DESC
    LIMIT $limit OFFSET $offset
  `);

  const users = [];
  dataStmt.bind({ ...params, $limit: limit, $offset: offset });
  while (dataStmt.step()) {
    const user = dataStmt.getAsObject();
    user.accepted = Boolean(user.accepted);
    users.push(user);
  }
  dataStmt.free();

  return res.json({
    data: users,
    meta: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
});


app.put('/api/admin/users/:id', authenticateToken, requireRole('Администратор'), (req, res) => {
  const userId = Number(req.params.id);
  const { role, accepted, position } = req.body;

  const checkStmt = db.prepare('SELECT id FROM users WHERE id = $id');
  const exists = checkStmt.getAsObject({ $id: userId }).id;
  checkStmt.free();

  if (!exists) {
    return res.status(404).json({ message: 'User not found' });
  }

  db.run(`
    UPDATE users 
    SET role = ?, accepted = ?, position = ?
    WHERE id = ?
  `, [role, accepted ? 1 : 0, position || '', userId]);

  saveDb();

  return res.json({ message: 'User updated successfully' });
});


app.get('/api/booking/cars', authenticateToken, requireAccepted, (req, res) => {
  refreshExpiredReservations();

  const stmt = db.prepare('SELECT * FROM cars ORDER BY id');
  const cars = [];

  while (stmt.step()) {
    const car = stmt.getAsObject();
    const now = Date.now();
    const expiresAt = car.expires_at ? new Date(car.expires_at).getTime() : null;
    const isReservedByMe = Number(car.reserved_by) === Number(req.user.id);

    const userStmt = db.prepare('SELECT role FROM users WHERE id = $id');
    const user = userStmt.getAsObject({ $id: req.user.id });
    userStmt.free();
    const isAdmin = user.role === 'Администратор';

    cars.push({
      ...car,
      status: car.status,
      isReservedByMe,
      canConfirm: car.status === 'reserved' && isReservedByMe && Boolean(expiresAt && expiresAt > now),
      canFinish: car.status === 'busy' && (isReservedByMe || isAdmin)
    });
  }

  stmt.free();
  res.json({ data: cars });
});

app.post('/api/booking/cars/:id/reserve', authenticateToken, requireAccepted, (req, res) => {
  refreshExpiredReservations();

  const carId = Number(req.params.id);
  const stmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const car = stmt.getAsObject({ $id: carId });
  stmt.free();

  if (!car.id) {
    return res.status(404).json({ message: 'Car not found' });
  }

  if (car.status !== 'free') {
    return res.status(409).json({ message: 'Car is not available for reservation' });
  }

  const reservedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.run(`
    UPDATE cars
    SET status = 'reserved', reserved_by = ?, reserved_at = ?, expires_at = ?, updated_at = ?
    WHERE id = ?
  `, [req.user.id, reservedAt, expiresAt, now, carId]);

  saveDb();

  const updatedStmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const updatedCar = updatedStmt.getAsObject({ $id: carId });
  updatedStmt.free();

  return res.json({ message: 'Car reserved successfully', car: updatedCar });
});

app.post('/api/booking/cars/:id/confirm', authenticateToken, requireAccepted, (req, res) => {
  refreshExpiredReservations();

  const carId = Number(req.params.id);
  const stmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const car = stmt.getAsObject({ $id: carId });
  stmt.free();

  if (!car.id) {
    return res.status(404).json({ message: 'Car not found' });
  }

  if (car.status !== 'reserved') {
    return res.status(409).json({ message: 'Car is not reserved' });
  }

  if (Number(car.reserved_by) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'You cannot confirm this reservation' });
  }

  if (car.expires_at && new Date(car.expires_at).getTime() < Date.now()) {
    return res.status(409).json({ message: 'Reservation expired' });
  }

  const now = new Date().toISOString();

  db.run(`
    UPDATE cars
    SET status = 'busy', confirmed_at = ?, updated_at = ?, expires_at = NULL
    WHERE id = ?
  `, [now, now, carId]);

  saveDb();

  const updatedStmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const updatedCar = updatedStmt.getAsObject({ $id: carId });
  updatedStmt.free();

  return res.json({ message: 'Reservation confirmed', car: updatedCar });
});

app.post('/api/booking/cars/:id/finish', authenticateToken, requireAccepted, (req, res) => {
  const carId = Number(req.params.id);
  const stmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const car = stmt.getAsObject({ $id: carId });
  stmt.free();

  if (!car.id) {
    return res.status(404).json({ message: 'Car not found' });
  }

  if (car.status !== 'busy') {
    return res.status(409).json({ message: 'Car is not in use' });
  }

  const userStmt = db.prepare('SELECT role FROM users WHERE id = $id');
  const user = userStmt.getAsObject({ $id: req.user.id });
  userStmt.free();
  const isAdmin = user.role === 'Администратор';

  if (Number(car.reserved_by) !== Number(req.user.id) && !isAdmin) {
    return res.status(403).json({ message: 'You cannot finish this trip' });
  }

  const now = new Date().toISOString();

  db.run(`
    UPDATE cars
    SET status = 'free', reserved_by = NULL, reserved_at = NULL, expires_at = NULL, confirmed_at = NULL, updated_at = ?
    WHERE id = ?
  `, [now, carId]);

  saveDb();

  const updatedStmt = db.prepare('SELECT * FROM cars WHERE id = $id');
  const updatedCar = updatedStmt.getAsObject({ $id: carId });
  updatedStmt.free();

  return res.json({ message: 'Trip finished', car: updatedCar });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend is running on http://localhost:${port}`);
});