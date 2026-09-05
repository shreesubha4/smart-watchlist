import { useState } from 'react';
import { api } from '../api';

export default function DemoControls({ watchlistId, symbols, onTriggered }) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(symbols[0] || '');
  const [busy, setBusy] = useState(false);

  if (symbols.length === 0) return null;

  const trigger = async (direction) => {
    const sym = symbol || symbols[0];
    setBusy(true);
    try {
      await api.forceSpike(watchlistId, sym, direction);
      await onTriggered();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 border border-dashed border-border-soft rounded-lg p-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-faint hover:text-text-muted cursor-pointer"
      >
        {open ? '−' : '+'} demo controls (judges/testing)
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-bg border border-border-soft rounded-md px-2 py-1.5 text-xs font-mono text-text"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => trigger('up')}
            disabled={busy}
            className="text-xs font-mono border border-gain/40 text-gain rounded px-2 py-1.5
                       cursor-pointer hover:bg-gain/10 disabled:opacity-40"
          >
            force spike ↑
          </button>
          <button
            onClick={() => trigger('down')}
            disabled={busy}
            className="text-xs font-mono border border-loss/40 text-loss rounded px-2 py-1.5
                       cursor-pointer hover:bg-loss/10 disabled:opacity-40"
          >
            force spike ↓
          </button>
          <span className="text-xs text-text-faint">
            instantly injects a guaranteed significant move for the demo
          </span>
        </div>
      )}
    </div>
  );
}
