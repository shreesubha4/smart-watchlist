import { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';
import DigestSection from './components/DigestSection';
import AddStock from './components/AddStock';
import EmptyState from './components/EmptyState';
import Login from './components/Login';
import DemoControls from './components/DemoControls';

function timeAgo(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [watchlist, setWatchlist] = useState(null);
  const [items, setItems] = useState([]);
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On load, check if we already have a valid token (returning user / same device).
  useEffect(() => {
    (async () => {
      if (!getToken()) { setCheckingAuth(false); return; }
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        setToken(null);
      } finally {
        setCheckingAuth(false);
      }
    })();

    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  // Bootstrap watchlist once authed.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const lists = await api.listWatchlists();
        let wl = lists[0];
        if (!wl) wl = await api.createWatchlist('My Watchlist');
        setWatchlist(wl);
      } catch (e) {
        setError('Could not reach the backend. Is it running on :4000?');
      }
    })();
  }, [user]);

  const refreshItems = useCallback(async (wlId) => {
    const its = await api.listItems(wlId);
    setItems(its);
  }, []);

  const refreshDigest = useCallback(async (wlId) => {
    const d = await api.getDigest(wlId);
    setDigest(d);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!watchlist) return;
    refreshItems(watchlist.id);
    refreshDigest(watchlist.id);
    const interval = setInterval(() => refreshDigest(watchlist.id), 10000);
    return () => clearInterval(interval);
  }, [watchlist, refreshItems, refreshDigest]);

  const handleAdd = async (symbol, tag) => {
    await api.addItem(watchlist.id, symbol, tag);
    await refreshItems(watchlist.id);
  };

  const handleRemove = async (symbol) => {
    await api.removeItem(watchlist.id, symbol);
    await refreshItems(watchlist.id);
    await refreshDigest(watchlist.id);
  };

  const handleMarkSeen = async () => {
    await api.markSeen(watchlist.id);
    await refreshDigest(watchlist.id);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setWatchlist(null);
    setDigest(null);
    setItems([]);
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-bg" />; // avoid a login-screen flash on refresh
  }

  if (!user) {
    return <Login onAuthed={setUser} />;
  }

  const totalStocks = digest ? digest.high.length + digest.moderate.length + digest.quiet.length : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-2xl mx-auto px-5 pt-10 pb-24">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Signal</h1>
            <p className="text-text-muted text-sm mt-1">
              {watchlist ? watchlist.name : 'Loading your watchlist…'}
            </p>
          </div>
          <div className="text-right">
            {digest && (
              <>
                <div className="font-mono text-xs text-text-faint">
                  updated {timeAgo(digest.generatedAt)}
                </div>
                <button
                  onClick={handleMarkSeen}
                  className="mt-2 text-xs font-mono text-text-muted hover:text-text border border-border rounded px-2 py-1 transition-colors cursor-pointer"
                >
                  mark all seen
                </button>
              </>
            )}
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="text-xs text-text-faint">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-text-faint hover:text-text cursor-pointer underline"
              >
                log out
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="border border-high/40 bg-high-soft text-high rounded-md px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <AddStock onAdd={handleAdd} disabled={!watchlist} />

        {loading && !error && (
          <div className="text-text-faint text-sm mt-10 font-mono">loading watchlist…</div>
        )}

        {!loading && totalStocks === 0 && !error && <EmptyState />}

        {digest && totalStocks > 0 && (
          <div className="mt-8 space-y-8">
            <DigestSection
              title="Needs attention"
              items={digest.high}
              tier="high"
              onRemove={handleRemove}
            />
            <DigestSection
              title="Worth a glance"
              items={digest.moderate}
              tier="moderate"
              onRemove={handleRemove}
            />
            <DigestSection
              title="Quiet"
              items={digest.quiet}
              tier="quiet"
              onRemove={handleRemove}
              collapsible
            />
          </div>
        )}

        {watchlist && items.length > 0 && (
          <DemoControls
            watchlistId={watchlist.id}
            symbols={items.map((i) => i.symbol)}
            onTriggered={() => refreshDigest(watchlist.id)}
          />
        )}
      </div>
    </div>
  );
}
