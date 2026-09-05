const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// For a hackathon this is fine hardcoded with a fallback; in real deployment
// this MUST come from an environment variable.
const JWT_SECRET = process.env.JWT_SECRET || 'hackathon-demo-secret-change-me';
const TOKEN_EXPIRY = '30d'; // long-lived so "return later" actually works across days

function signup(email, password) {
  email = email.trim().toLowerCase();
  if (!email || !password || password.length < 6) {
    throw Object.assign(new Error('Email and a password of at least 6 characters are required'), { status: 400 });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    throw Object.assign(new Error('An account with that email already exists'), { status: 409 });
  }
  const id = randomUUID();
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`).run(id, email, password_hash);

  // Give every new user a default watchlist so the app is immediately usable.
  const wlId = randomUUID();
  db.prepare(`INSERT INTO watchlists (id, user_id, name) VALUES (?, ?, ?)`).run(wlId, id, 'My Watchlist');

  return issueToken({ id, email });
}

function login(email, password) {
  email = email.trim().toLowerCase();
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }
  return issueToken({ id: user.id, email: user.email });
}

function issueToken(user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  return { token, user: { id: user.id, email: user.email } };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signup, login, authMiddleware };
