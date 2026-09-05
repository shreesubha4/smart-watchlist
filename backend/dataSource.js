// dataSource.js
// This is the ONLY file you need to touch to swap in a real API (Finnhub, Twelve Data, etc).
// Right now it simulates realistic price movement so the demo works without an API key / network.

const state = {}; // symbol -> { price, baseVolume }

// Demo control: when set, the next fetchQuote() call for this symbol forces a big move
// instead of relying on the ~15% random chance. Used by the "force spike" demo endpoint
// so you're never gambling on a random tick during live judging.
const forcedSpikes = {}; // symbol -> { direction: 1 | -1 }

function forceSpike(symbol, direction = null) {
  forcedSpikes[symbol.toUpperCase()] = { direction: direction || (Math.random() < 0.5 ? -1 : 1) };
}

const SEED_PRICES = {
  AAPL: 227, TSLA: 245, MSFT: 415, GOOGL: 168, AMZN: 186,
  NVDA: 118, INFY: 1850, TCS: 4150, RELIANCE: 2950, HDFCBANK: 1650,
};

function initSymbol(symbol) {
  if (!state[symbol]) {
    const base = SEED_PRICES[symbol] || 100 + Math.random() * 500;
    state[symbol] = { price: base, baseVolume: 500000 + Math.random() * 2000000 };
  }
  return state[symbol];
}

// Occasionally injects a "big move" so the demo has something interesting to show.
function shouldSpike() {
  return Math.random() < 0.15; // 15% chance per tick
}

async function fetchQuote(symbol) {
  const s = initSymbol(symbol);
  const forced = forcedSpikes[symbol];
  const spike = forced || shouldSpike();

  let pctMove;
  if (forced) {
    // Guaranteed, clearly "high tier" move: 9-13% in the requested direction.
    pctMove = (0.09 + Math.random() * 0.04) * forced.direction;
    delete forcedSpikes[symbol]; // one-shot
  } else if (spike) {
    pctMove = (Math.random() * 0.08 - 0.04) * (Math.random() < 0.5 ? -1 : 1); // up to ~8%
  } else {
    pctMove = (Math.random() * 0.01 - 0.005); // up to ~0.5%
  }

  s.price = Math.max(1, s.price * (1 + pctMove));
  const volume = Math.round(s.baseVolume * (forced ? 4 + Math.random() * 2 : spike ? 2 + Math.random() * 3 : 0.7 + Math.random() * 0.6));

  // Simulate occasional data flakiness: sometimes the provider returns nothing,
  // sometimes it actually throws (timeout, malformed response, connection reset).
  // Both are realistic failure modes for a real market data API and both are
  // handled by the poller's per-symbol try/catch — this isn't hidden behind a
  // clean "return null" only.
  if (!forced && Math.random() < 0.02) {
    throw new Error('simulated upstream timeout');
  }
  const failed = !forced && Math.random() < 0.02;
  if (failed) return null;

  return {
    symbol,
    price: Number(s.price.toFixed(2)),
    volume,
    day_high: Number((s.price * 1.01).toFixed(2)),
    day_low: Number((s.price * 0.99).toFixed(2)),
    timestamp: Date.now(),
    source: 'mock-feed',
  };
}

module.exports = { fetchQuote, forceSpike };

/* ---- TO USE A REAL API (e.g. Finnhub) LATER, replace fetchQuote with: ----
const axios = require('axios');
async function fetchQuote(symbol) {
  try {
    const res = await axios.get(`https://finnhub.io/api/v1/quote`, {
      params: { symbol, token: process.env.FINNHUB_KEY }
    });
    const d = res.data;
    if (!d || d.c === 0) return null;
    return {
      symbol, price: d.c, volume: null, day_high: d.h, day_low: d.l,
      timestamp: Date.now(), source: 'finnhub'
    };
  } catch (e) { return null; }
}
------------------------------------------------------------------------ */
