import { useState } from 'react';

const SUGGESTIONS = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'INFY', 'TCS', 'RELIANCE', 'HDFCBANK'];

export default function AddStock({ onAdd, disabled }) {
  const [symbol, setSymbol] = useState('');
  const [tag, setTag] = useState('');
  const [showTag, setShowTag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (sym) => {
    const s = (sym || symbol).trim().toUpperCase();
    if (!s || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      await onAdd(s, tag.trim() || null);
      setSymbol('');
      setTag('');
      setShowTag(false);
    } catch (e) {
      setErr(e.message || 'Could not add symbol');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-surface">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Add a symbol (e.g. AAPL)"
            disabled={disabled || submitting}
            className="flex-1 bg-bg border border-border-soft rounded-md px-3 py-2 text-sm font-mono
                       text-text placeholder:text-text-faint outline-none focus:border-text-faint
                       disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowTag(!showTag)}
            className="text-xs text-text-faint hover:text-text border border-border-soft rounded-md px-2
                       cursor-pointer"
            title="Add a reason for watching (optional)"
          >
            {showTag ? '−' : '+ tag'}
          </button>
          <button
            type="submit"
            disabled={disabled || submitting || !symbol.trim()}
            className="bg-text text-bg text-sm font-medium rounded-md px-4 py-2 cursor-pointer
                       disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Add
          </button>
        </div>

        {showTag && (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Why are you watching this? (e.g. earnings play)"
            className="bg-bg border border-border-soft rounded-md px-3 py-2 text-sm
                       text-text placeholder:text-text-faint outline-none focus:border-text-faint"
          />
        )}
      </form>

      {err && <div className="text-loss text-xs mt-2">{err}</div>}

      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={disabled || submitting}
            className="text-xs font-mono text-text-faint hover:text-text hover:border-text-faint
                       border border-border-soft rounded px-2 py-1 cursor-pointer transition-colors
                       disabled:opacity-30"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
