# Smart Watchlist — Setup & Run

## 1. Backend

```bash
cd backend
npm install
node server.js
```

Runs on **http://localhost:4000**. It uses SQLite (`watchlist.db`, auto-created)
so there's nothing to configure. On startup it also begins polling every 15s
for any symbol currently on a watchlist — right now via a realistic **mock feed**
(see `dataSource.js`), so the demo works with zero API keys and zero network
dependency.

**To swap in real market data:** open `dataSource.js` — it's the only file
that talks to the outside world. There's a commented-out Finnhub example at
the bottom. Get a free key at finnhub.io, set `FINNHUB_KEY` in your env, and
swap the function body. Nothing else in the codebase needs to change — that's
the point of isolating it.

## 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on **http://localhost:5173**, proxies `/api` to the backend on :4000
(see `vite.config.js`).

## 3. Try it

1. Open the app — you'll land on a login/signup screen
2. Sign up with any email + a password (6+ characters). This creates a real account
   with a hashed password and a JWT session, plus a default watchlist for you.
3. Add a few symbols (click the suggestion chips — AAPL, TSLA, etc.)
4. Wait ~15-30s for a couple of natural poll ticks (this lets a real baseline build up)
5. **For a guaranteed dramatic moment (recommended for live demos):** open
   "+ demo controls" near the bottom, pick a symbol, click "force spike ↑" or "↓".
   This instantly injects a large, realistic move and refreshes the digest —
   no waiting on the ~15% random chance. Use this on stage instead of hoping.
6. Watch the stock jump into "Needs attention" with a computed reason
7. Click "mark all seen," then trigger another spike — see it register as new
8. Refresh the page entirely, or open the app in a different browser and log in
   with the same account — your watchlist and "what's changed" state follow you,
   because it's stored server-side keyed to your account, not localStorage

## Auth notes

- Passwords are hashed with bcrypt, sessions are JWTs (30-day expiry — long enough
  that "return later" genuinely works across days, not just the same browser tab)
- `JWT_SECRET` is hardcoded with a fallback for hackathon convenience — for anything
  beyond a demo, set it via an environment variable
- Every watchlist route checks that the watchlist actually belongs to the requesting
  user (see `loadOwnedWatchlist` in `server.js`) — one user can't read or modify
  another's data by guessing an ID

---

## How to explain this to judges (the "why")

**"What counts as a meaningful change?"**
Not a flat % threshold. We compute each stock's own typical daily volatility
and volume (`stock_baselines`, recalculated from recent snapshots), then score
new moves as a z-score against that baseline. A sleepy utility stock moving 3%
can outrank a volatile stock moving 6%, because it's the *relative* surprise
that matters, not the raw number. See `scoring.js` — `scoreSymbol()`.

**"How does state persist across sessions/devices?"**
Real accounts now back this: signup/login issues a JWT (bcrypt-hashed passwords,
30-day session), and `user_last_seen` is a server-side table keyed by (user_id,
symbol) — not localStorage. Log in from any device with the same account and you
get the identical diff. The digest compares the *current* snapshot to the *last
one this user explicitly marked seen*, not just "yesterday" — so if you don't
check for 3 days, you still see everything that changed in that window, not just
the latest tick.

**"How do you handle stale/conflicting data?"**
Every snapshot is timestamped and tagged with a `source`. If a poll tick fails
for a symbol, we skip writing bad data rather than guessing — the *next*
digest read notices the timestamp gap and flags `isStale: true` rather than
silently showing old data as current. `dataSource.js` simulates ~3% random
fetch failures specifically so this path is demoable.

**"Why polling, not websockets?"**
Users check a watchlist periodically, not tick-by-tick — polling every 15s
(tunable) is far simpler to build, debug and demo, and honest about the kind
of freshness a watchlist actually needs.

**"How does this scale?"**
The poller only fetches symbols that appear on *at least one* watchlist,
deduplicated — 10,000 users watching AAPL is one API call per tick, not
10,000. SQLite is fine for a hackathon; the schema maps directly onto
Postgres for production, and snapshot reads could move to Redis if digest
latency became a bottleneck at scale.

**Where we cut scope on purpose:**
No news/sentiment integration, no multi-source reconciliation — both
straightforward extensions of the existing schema (the `source` column on
snapshots already anticipates multiple feeds), but not worth the build time
for a 24-hour judge demo. We prioritized making the *scoring, diffing, and
auth* real and correct over breadth of features.

**The one deliberately fake thing, stated upfront:**
Market data is a realistic mock feed (drift + occasional spikes + occasional
fetch failures), not a live API — this keeps the demo reliable regardless of
market hours or network conditions. `dataSource.js` isolates this behind a
single `fetchQuote()` function; swapping in Finnhub/Twelve Data touches
nothing else in the codebase.
