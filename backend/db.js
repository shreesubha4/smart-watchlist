// Uses Node's built-in SQLite (available Node 22.5+, no native compilation needed —
// this avoids the node-gyp/Visual Studio Build Tools requirement that better-sqlite3 has).
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('watchlist.db');

db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  tag TEXT,
  added_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(watchlist_id, symbol)
);

CREATE TABLE IF NOT EXISTS stock_snapshots (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  volume INTEGER,
  day_high REAL,
  day_low REAL,
  source TEXT DEFAULT 'mock',
  is_stale INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_snap_symbol_time ON stock_snapshots(symbol, timestamp DESC);

CREATE TABLE IF NOT EXISTS stock_baselines (
  symbol TEXT PRIMARY KEY,
  avg_daily_volatility REAL,
  avg_volume REAL,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_last_seen (
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  last_seen_snapshot_id TEXT,
  last_seen_at INTEGER,
  PRIMARY KEY (user_id, symbol)
);
`);

module.exports = db;
