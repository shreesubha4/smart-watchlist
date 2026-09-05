const BASE = '/api';
const TOKEN_KEY = 'watchlist_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  if (res.status === 401) {
    setToken(null);
    // Let the app re-render into the login screen on the next state check.
    window.dispatchEvent(new Event('auth:expired'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  signup: (email, password) => req('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => req('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => req('/auth/me'),

  listWatchlists: () => req('/watchlist'),
  createWatchlist: (name) => req('/watchlist', { method: 'POST', body: JSON.stringify({ name }) }),
  listItems: (watchlistId) => req(`/watchlist/${watchlistId}/items`),
  addItem: (watchlistId, symbol, tag) =>
    req(`/watchlist/${watchlistId}/items`, { method: 'POST', body: JSON.stringify({ symbol, tag }) }),
  removeItem: (watchlistId, symbol) =>
    req(`/watchlist/${watchlistId}/items/${symbol}`, { method: 'DELETE' }),
  getDigest: (watchlistId) => req(`/watchlist/${watchlistId}/digest`),
  markSeen: (watchlistId) => req(`/watchlist/${watchlistId}/mark-seen`, { method: 'POST' }),
  forceSpike: (watchlistId, symbol, direction) =>
    req(`/watchlist/${watchlistId}/demo/force-spike`, { method: 'POST', body: JSON.stringify({ symbol, direction }) }),
};
