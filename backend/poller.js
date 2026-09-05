const { randomUUID } = require('crypto');
const db = require('./db');
const { fetchQuote } = require('./dataSource');

const FETCH_TIMEOUT_MS = 5000; // guard against a real provider hanging indefinitely

function getWatchedSymbols() {
  const rows = db.prepare(`SELECT DISTINCT symbol FROM watchlist_items`).all();
  return rows.map(r => r.symbol);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function pollOnce() {
  const symbols = getWatchedSymbols();
  const insert = db.prepare(`
    INSERT INTO stock_snapshots (id, symbol, timestamp, price, volume, day_high, day_low, source, is_stale)
    VALUES (@id, @symbol, @timestamp, @price, @volume, @day_high, @day_low, @source, @is_stale)
  `);

  let failures = 0;
  for (const symbol of symbols) {
    // Each symbol is isolated: one bad fetch (timeout, thrown error, malformed
    // response from an unreliable upstream) must not take down the whole tick
    // for every other symbol / every other user watching them.
    try {
      const quote = await withTimeout(fetchQuote(symbol), FETCH_TIMEOUT_MS);
      if (!quote) {
        // Fetch returned "no data" cleanly (e.g. provider had nothing) — skip writing.
        // The digest layer detects the resulting timestamp gap and flags is_stale,
        // rather than us guessing or silently reusing old data as if it were fresh.
        failures++;
        continue;
      }
      insert.run({
        id: randomUUID(),
        symbol: quote.symbol,
        timestamp: quote.timestamp,
        price: quote.price,
        volume: quote.volume,
        day_high: quote.day_high,
        day_low: quote.day_low,
        source: quote.source,
        is_stale: 0,
      });
    } catch (err) {
      failures++;
      console.error(`[poller] ${symbol} failed (${err.message}) — skipping this tick, other symbols unaffected`);
    }
  }
  if (symbols.length) {
    console.log(`[poller] tick complete: ${symbols.length - failures}/${symbols.length} symbols updated @ ${new Date().toLocaleTimeString()}`);
  }
}

function recomputeBaselines() {
  const symbols = getWatchedSymbols();
  const upsert = db.prepare(`
    INSERT INTO stock_baselines (symbol, avg_daily_volatility, avg_volume, updated_at)
    VALUES (@symbol, @vol, @avgVolume, @now)
    ON CONFLICT(symbol) DO UPDATE SET avg_daily_volatility=@vol, avg_volume=@avgVolume, updated_at=@now
  `);

  for (const symbol of symbols) {
    try {
      // Exclude the single most-recent snapshot from the baseline: otherwise a big
      // move dilutes the very "normal behavior" measure it's about to be scored against.
      // Baseline = what this stock looked like *before* the latest tick, not including it.
      const rows = db.prepare(
        `SELECT price, volume FROM stock_snapshots WHERE symbol = ? ORDER BY timestamp DESC LIMIT 50 OFFSET 1`
      ).all(symbol);

      if (rows.length < 2) continue;

      const prices = rows.map(r => r.price);
      const pctChanges = [];
      for (let i = 0; i < prices.length - 1; i++) {
        pctChanges.push(Math.abs((prices[i] - prices[i + 1]) / prices[i + 1]));
      }
      const avgVol = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length || 0.005;
      const avgVolume = rows.reduce((a, r) => a + (r.volume || 0), 0) / rows.length || 1;

      upsert.run({ symbol, vol: Math.max(avgVol, 0.001), avgVolume, now: Date.now() });
    } catch (err) {
      // Same isolation principle: a bad baseline calc for one symbol shouldn't
      // stop every other symbol's baseline from updating.
      console.error(`[poller] baseline recompute failed for ${symbol}: ${err.message}`);
    }
  }
}

// Guards against overlapping ticks: setInterval does NOT wait for an async
// callback to finish, so a slow/hanging fetch could otherwise let a second
// pollOnce() start before the first one is done — interleaved writes and a
// recompute running against a half-finished tick. inProgress prevents that.
let inProgress = false;

async function runTick() {
  if (inProgress) {
    console.log('[poller] previous tick still running, skipping this interval to avoid overlap');
    return;
  }
  inProgress = true;
  try {
    await pollOnce();
    recomputeBaselines();
  } catch (err) {
    console.error('[poller] unexpected error in tick:', err.message);
  } finally {
    inProgress = false;
  }
}

function startPolling(intervalMs = 15000) {
  runTick();
  setInterval(runTick, intervalMs);
}

module.exports = { startPolling, pollOnce, recomputeBaselines };
