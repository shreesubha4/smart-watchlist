const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');
const db = require('./db');
const { scoreSymbol } = require('./scoring');
const { startPolling, pollOnce } = require('./poller');
const { forceSpike } = require('./dataSource');
const { signup, login, authMiddleware } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// --- Auth ---

app.post('/auth/signup', (req, res) => {
  try {
    const { email, password } = req.body;
    const result = signup(email, password);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const result = login(email, password);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ id: req.userId, email: req.userEmail });
});

// Everything below requires a valid token.
app.use(authMiddleware);

// --- Ownership guard: a watchlist must belong to the requesting user ---
function loadOwnedWatchlist(req, res, next) {
  const wl = db.prepare(`SELECT * FROM watchlists WHERE id = ? AND user_id = ?`)
    .get(req.params.id, req.userId);
  if (!wl) return res.status(404).json({ error: 'Watchlist not found' });
  req.watchlist = wl;
  next();
}

// --- Watchlist CRUD ---

app.post('/watchlist', (req, res) => {
  const { name } = req.body;
  const id = randomUUID();
  db.prepare(`INSERT INTO watchlists (id, user_id, name) VALUES (?, ?, ?)`)
    .run(id, req.userId, name || 'My Watchlist');
  res.json({ id, name: name || 'My Watchlist', user_id: req.userId });
});

app.get('/watchlist', (req, res) => {
  const lists = db.prepare(`SELECT * FROM watchlists WHERE user_id = ?`).all(req.userId);
  res.json(lists);
});

app.post('/watchlist/:id/items', loadOwnedWatchlist, (req, res) => {
  const { symbol, tag } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const id = randomUUID();
  try {
    db.prepare(`INSERT INTO watchlist_items (id, watchlist_id, symbol, tag) VALUES (?, ?, ?, ?)`)
      .run(id, req.params.id, symbol.toUpperCase(), tag || null);
  } catch (e) {
    return res.status(409).json({ error: 'symbol already in watchlist' });
  }
  res.json({ id, symbol: symbol.toUpperCase(), tag });
});

app.delete('/watchlist/:id/items/:symbol', loadOwnedWatchlist, (req, res) => {
  db.prepare(`DELETE FROM watchlist_items WHERE watchlist_id = ? AND symbol = ?`)
    .run(req.params.id, req.params.symbol.toUpperCase());
  res.json({ ok: true });
});

app.get('/watchlist/:id/items', loadOwnedWatchlist, (req, res) => {
  const items = db.prepare(`SELECT * FROM watchlist_items WHERE watchlist_id = ?`).all(req.params.id);
  res.json(items);
});

// --- THE MAIN FEATURE: digest ---

app.get('/watchlist/:id/digest', loadOwnedWatchlist, (req, res) => {
  const items = db.prepare(`SELECT * FROM watchlist_items WHERE watchlist_id = ?`).all(req.params.id);
  const results = items
    .map(item => scoreSymbol(req.userId, item.symbol))
    .filter(Boolean)
    .map((r) => ({ ...r, tag: items.find(it => it.symbol === r.symbol)?.tag || null }))
    .sort((a, b) => b.score - a.score);

  res.json({
    generatedAt: Date.now(),
    high: results.filter(r => r.tier === 'high'),
    moderate: results.filter(r => r.tier === 'moderate'),
    quiet: results.filter(r => r.tier === 'quiet'),
  });
});

app.post('/watchlist/:id/mark-seen', loadOwnedWatchlist, (req, res) => {
  const items = db.prepare(`SELECT * FROM watchlist_items WHERE watchlist_id = ?`).all(req.params.id);
  const upsert = db.prepare(`
    INSERT INTO user_last_seen (user_id, symbol, last_seen_snapshot_id, last_seen_at)
    VALUES (@userId, @symbol, @snapshotId, @now)
    ON CONFLICT(user_id, symbol) DO UPDATE SET last_seen_snapshot_id=@snapshotId, last_seen_at=@now
  `);

  for (const item of items) {
    const scored = scoreSymbol(req.userId, item.symbol);
    if (!scored) continue;
    upsert.run({
      userId: req.userId,
      symbol: item.symbol,
      snapshotId: scored.latestSnapshotId,
      now: Date.now(),
    });
  }
  res.json({ ok: true, markedAt: Date.now() });
});

// --- Demo helper: force a guaranteed dramatic move on the very next poll tick,
// so you never have to gamble on a random spike happening while judges are watching. ---
app.post('/watchlist/:id/demo/force-spike', loadOwnedWatchlist, async (req, res) => {
  const { symbol, direction } = req.body; // direction: 'up' | 'down' | omitted (random)
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  const dir = direction === 'up' ? 1 : direction === 'down' ? -1 : null;
  forceSpike(symbol.toUpperCase(), dir);
  await pollOnce();  // apply immediately instead of waiting up to 15s
  // Deliberately NOT calling recomputeBaselines() here: doing so would fold the
  // spike itself into "what's normal for this stock," diluting its own z-score.
  // The baseline stays based on prior genuine behavior, so the spike is judged
  // against what the stock actually looked like before — which is the whole point.
  res.json({ ok: true, symbol: symbol.toUpperCase() });
});

const PORT = process.env.PORT || 4000;

// Safety net: log unexpected errors instead of letting the whole process crash
// and take down every user's connection over one bad promise somewhere.
process.on('unhandledRejection', (err) => {
  console.error('[server] unhandled rejection (not crashing):', err);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception (not crashing):', err);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startPolling(15000); // poll every 15s — fine for demo, tune for real use
});
