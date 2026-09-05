const db = require('./db');

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min -> considered stale for demo purposes

const WEIGHTS = {
  price: 1.0,
  volume: 0.6,
};

function getLatestSnapshot(symbol) {
  return db.prepare(
    `SELECT * FROM stock_snapshots WHERE symbol = ? ORDER BY timestamp DESC LIMIT 1`
  ).get(symbol);
}

function getBaseline(symbol) {
  return db.prepare(`SELECT * FROM stock_baselines WHERE symbol = ?`).get(symbol);
}

function getLastSeen(userId, symbol) {
  return db.prepare(
    `SELECT * FROM user_last_seen WHERE user_id = ? AND symbol = ?`
  ).get(userId, symbol);
}

function getSnapshotById(id) {
  if (!id) return null;
  return db.prepare(`SELECT * FROM stock_snapshots WHERE id = ?`).get(id);
}

/**
 * Core "meaningful change" logic.
 * Compares current snapshot to the snapshot the user last saw (not just the previous tick),
 * normalized against the stock's own typical behavior (baseline).
 */
function scoreSymbol(userId, symbol) {
  const latest = getLatestSnapshot(symbol);
  if (!latest) return null;

  const baseline = getBaseline(symbol);
  const lastSeenRow = getLastSeen(userId, symbol);
  const lastSeenSnapshot = getSnapshotById(lastSeenRow?.last_seen_snapshot_id) || latest;

  const isFirstView = !lastSeenRow;
  const isStale = Date.now() - latest.timestamp > STALE_THRESHOLD_MS;

  const priceChangePct = lastSeenSnapshot
    ? (latest.price - lastSeenSnapshot.price) / lastSeenSnapshot.price
    : 0;

  const avgVol = baseline?.avg_daily_volatility || 0.01; // fallback 1% if no baseline yet
  const avgVolume = baseline?.avg_volume || latest.volume || 1;

  // z-score style: how many "normal daily moves" did this represent?
  const priceZ = Math.abs(priceChangePct) / avgVol;
  const volumeRatio = latest.volume ? latest.volume / avgVolume : 1;
  const volumeSignal = Math.log2(Math.max(volumeRatio, 0.01) + 1); // dampens extreme ratios

  let score = WEIGHTS.price * priceZ + WEIGHTS.volume * volumeSignal;

  let tier = 'quiet';
  if (score >= 2.2) tier = 'high';
  else if (score >= 1.0) tier = 'moderate';

  // reasons, human readable
  const reasons = [];
  if (priceZ >= 1.0) {
    reasons.push(`moved ${(priceChangePct * 100).toFixed(1)}% — larger than its typical daily swing`);
  }
  if (volumeRatio >= 1.8) {
    reasons.push(`trading at ${volumeRatio.toFixed(1)}x normal volume`);
  }
  if (reasons.length === 0) reasons.push('within normal range');

  return {
    symbol,
    price: latest.price,
    priceChangePct: Number((priceChangePct * 100).toFixed(2)),
    volume: latest.volume,
    volumeRatio: Number(volumeRatio.toFixed(2)),
    score: Number(score.toFixed(2)),
    tier,
    reasons,
    isFirstView,
    isStale,
    asOf: latest.timestamp,
    lastSeenAt: lastSeenRow?.last_seen_at || null,
    latestSnapshotId: latest.id,
  };
}

module.exports = { scoreSymbol };
