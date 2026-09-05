import { useState } from 'react';
import { api, setToken } from '../api';

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const result = mode === 'login'
        ? await api.login(email, password)
        : await api.signup(email, password);
      setToken(result.token);
      onAuthed(result.user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Signal</h1>
          <p className="text-text-muted text-sm mt-1">
            A watchlist that tells you what actually changed.
          </p>
        </div>

        <div className="border border-border rounded-lg p-6 bg-surface">
          <div className="flex gap-1 mb-5 text-sm">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 rounded-md cursor-pointer transition-colors ${
                mode === 'login' ? 'bg-bg text-text' : 'text-text-faint hover:text-text-muted'
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 rounded-md cursor-pointer transition-colors ${
                mode === 'signup' ? 'bg-bg text-text' : 'text-text-faint hover:text-text-muted'
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="bg-bg border border-border-soft rounded-md px-3 py-2 text-sm
                         text-text placeholder:text-text-faint outline-none focus:border-text-faint"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="bg-bg border border-border-soft rounded-md px-3 py-2 text-sm
                         text-text placeholder:text-text-faint outline-none focus:border-text-faint"
            />

            {err && <div className="text-loss text-xs">{err}</div>}

            <button
              type="submit"
              disabled={busy}
              className="bg-text text-bg text-sm font-medium rounded-md px-4 py-2 cursor-pointer
                         disabled:opacity-40 hover:opacity-90 transition-opacity mt-1"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-text-faint text-xs text-center mt-4">
          Your watchlist and "what changed" history are tied to your account —
          log in from any device and pick up where you left off.
        </p>
      </div>
    </div>
  );
}
