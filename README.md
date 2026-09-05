# Signal — a watchlist that tells you what actually changed

A stock watchlist that doesn't just show prices — it tells you *what's worth
your attention* since the last time you checked, scored relative to how that
specific stock normally behaves, not a flat threshold.

**Live demo:** _[add your deployed URL here once hosted — see "Deploying" below]_

---

## The core idea

Most watchlists make you scan a table and decide for yourself what matters.
Signal decides for you: every stock is scored against **its own typical daily
volatility and volume**, not an absolute percentage, so a sleepy stock moving
3% can outrank a volatile stock moving 6% — because for that first stock,
3% actually is unusual.

Three tiers, sorted by significance:
- **Needs attention** — genuinely surprising moves, expanded with the reason why
- **Worth a glance** — moderate, worth a scan
- **Quiet** — collapsed by default, nothing unusual

Returning later shows a diff against the last time *you* checked — not the
last tick, not "yesterday" — so a 3-day gap surfaces everything that happened
in that window, correctly, not just the most recent number.

---

## Setup

**Requires Node 22.5+** (uses the built-in `node:sqlite` module — see
"Why no database server" below).

```bash
cd backend && npm install && node server.js      # runs on :4000
cd frontend && npm install && npm run dev         # runs on :5173, proxies /api to :4000
```

Open the frontend URL, sign up with any email + 6-character password, add a
symbol, and wait ~15-30s for a poll tick. For a guaranteed dramatic moment
instead of waiting on a random one, use the **"+ demo controls"** panel at
the bottom of the app to force a significant move on any watched symbol —
useful for live demos, not part of the real product surface.

Full walkthrough and talking points: [`HOW_TO_RUN.md`](./HOW_TO_RUN.md)

---

## How this maps to the evaluation criteria

### Engineering depth (architecture, correctness, reliability, scalability)

- **Architecture:** background poller writes timestamped snapshots →
  significance is computed on read, comparing the latest snapshot to
  whatever the requesting user last marked seen (`stock_snapshots` +
  `user_last_seen`, see `scoring.js`). This separation means "what changed"
  is always derived fresh from real data, never a stale cached judgment.
- **Correctness:** the significance score deliberately **excludes the
  snapshot being scored from its own baseline calculation**
  (`poller.js:recomputeBaselines`) — otherwise a big move would dilute the
  very "what's normal" measure it's being judged against, understating its
  own significance. This was caught and fixed during testing, not assumed
  correct by design.
- **Reliability:** every external fetch is wrapped in a per-symbol
  try/catch with a timeout guard (`poller.js`), so one bad symbol or one
  slow/hanging provider call never takes down the tick for every other
  symbol or every other user. Process-level `unhandledRejection` /
  `uncaughtException` handlers log rather than crash.
- **Scalability:** the poller fetches each distinct symbol **once per tick
  regardless of how many users are watching it** (`getWatchedSymbols()`
  dedupes across all watchlists) — 10,000 users watching AAPL is one API
  call, not 10,000. The scoring/diffing logic is stateless per request and
  would scale horizontally behind a shared Postgres + Redis without any
  change to its shape (see "Scaling beyond a hackathon" below).

### Edge cases & resilience (failures, race conditions, integrity, unreliable dependencies)

- **Unreliable dependencies:** the mock data provider (`dataSource.js`)
  deliberately simulates both a clean "no data" response and a thrown
  timeout error, on separate random paths, so both realistic failure modes
  of a real market API are actually exercised, not just assumed handled.
- **Race condition — overlapping ticks:** `setInterval` does not wait for
  an async callback to finish. If a fetch ever hung past the poll interval,
  a second tick could start before the first finished, causing interleaved
  writes. Fixed with an `inProgress` guard in `poller.js` that skips a tick
  rather than letting two run concurrently.
- **Data integrity / staleness:** every snapshot carries its own timestamp
  and source. If a fetch fails, we skip writing rather than guessing —
  the digest layer independently detects the resulting timestamp gap and
  flags `isStale: true`, rather than silently presenting old data as current.
- **Auth / authorization races:** every watchlist-scoped route re-checks
  ownership server-side (`loadOwnedWatchlist` in `server.js`) rather than
  trusting a client-supplied ID — one user cannot read or mutate another
  user's watchlist by guessing an ID.
- **Input integrity:** duplicate symbols on a watchlist are rejected at the
  DB constraint level (`UNIQUE(watchlist_id, symbol)`), not just in
  application logic, so it holds even under concurrent requests.

### Product & problem interpretation

Chose to interpret "meaningful change" as *statistically relative*, not
absolute — this was a deliberate stance, not the default reading of the
brief. See `scoring.js` for the full reasoning in comments.

### Code quality & simplicity

- Single-responsibility files: `dataSource.js` (the only file that talks to
  the outside world), `scoring.js` (pure scoring logic, no I/O),
  `poller.js` (scheduling + resilience), `auth.js` (identity), `server.js`
  (routing + authorization).
- No framework beyond Express — deliberately avoided ORM/ODM overhead for
  a schema this small; raw SQL via `node:sqlite` is fully readable and
  there's no abstraction hiding what's actually being queried.

### Originality & thoughtfulness

- Relative/statistical significance instead of flat percentage thresholds
- Server-side "last seen" state instead of localStorage, so cross-device
  continuity actually works, not just cross-refresh
- A deliberately isolated `dataSource.js` so swapping in a real market API
  (Finnhub example included, commented, at the bottom of the file) touches
  exactly one file

---

## Deliberate simplifications (and why)

| Cut | Why | What it would take to add |
|---|---|---|
| Live market data | Keeps the demo reliable regardless of market hours/network at judging time | Swap `fetchQuote()` in `dataSource.js` — nothing else changes |
| News/sentiment signal | Out of scope for the time available | `NewsEvent` table already sketched in design notes; would feed into `scoring.js` as an additional weighted term |
| Multi-source reconciliation | Only one data source in use | `source` column on every snapshot already anticipates this — reconciliation logic would compare `source` + `timestamp` across providers |
| Redis caching layer | Unnecessary at hackathon scale | Digest reads are already a single indexed query; would front it with Redis only once read volume actually demanded it |

## Scaling beyond a hackathon

- **Database:** `node:sqlite` (a single-file, single-connection SQLite) is
  fine for a demo. The schema is plain relational SQL and maps directly
  onto Postgres — no code shape changes needed, just a connection string.
- **Poller:** currently a single in-process `setInterval`. At real scale
  this becomes a separate worker process (or a small fleet of them,
  sharded by symbol) writing to the same database, decoupled from the API
  server's request/response cycle.
- **Hot reads:** the digest endpoint recomputes scores on every request.
  At high read volume, the latest snapshot + baseline per symbol is a
  natural caching layer (Redis, short TTL) — cheap to add without touching
  the scoring logic itself.

## Why no database server (Postgres/MySQL) for the demo

`node:sqlite` (Node's built-in module, 22.5+) needs zero installation and
zero native compilation — deliberately chosen so grading this doesn't
depend on anyone's local build toolchain (this is also why we moved off
`better-sqlite3`, which requires node-gyp + a C++ toolchain and broke on
a plain Windows machine during our own testing). The schema is standard
SQL and portable to Postgres with no application-code changes.

## Deploying (for a working URL)

Two small services, no special infra:
- **Backend:** Render, Railway, or Fly.io — any of them run a plain Node
  process. Set `JWT_SECRET` as an environment variable in production
  (currently has a hackathon-only fallback default in `auth.js`).
- **Frontend:** Vercel or Netlify — `npm run build` produces a static
  `dist/` folder. Point its API calls at the deployed backend URL instead
  of the local Vite proxy.
