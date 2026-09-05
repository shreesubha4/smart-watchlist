import { useState } from 'react';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

const TIER_STYLES = {
  high: { dot: 'bg-high', label: 'text-high' },
  moderate: { dot: 'bg-moderate', label: 'text-moderate' },
  quiet: { dot: 'bg-text-faint', label: 'text-text-faint' },
};

function ChangeBadge({ pct }) {
  if (pct === 0 || pct === undefined) return <span className="text-text-faint font-mono text-sm">—</span>;
  const up = pct > 0;
  return (
    <span className={`font-mono text-sm ${up ? 'text-gain' : 'text-loss'}`}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function ExpandedCard({ item, onRemove }) {
  const style = TIER_STYLES[item.tier];
  return (
    <div className={`border border-border rounded-lg p-4 bg-surface ${item.isFirstView ? '' : 'pulse-once'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            <span className="font-mono font-medium text-base">{item.symbol}</span>
            {item.tag && (
              <span className="text-xs text-text-faint border border-border-soft rounded px-1.5 py-0.5">{item.tag}</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="font-mono text-xl">{item.price.toFixed(2)}</span>
            <ChangeBadge pct={item.priceChangePct} />
          </div>
        </div>
        <button
          onClick={() => onRemove(item.symbol)}
          className="text-text-faint hover:text-text text-xs cursor-pointer"
        >
          remove
        </button>
      </div>
      <div className="mt-3 space-y-1">
        {item.reasons.map((r, i) => (
          <div key={i} className={`text-sm ${style.label}`}>· {r}</div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-text-faint font-mono">
        <span>as of {timeAgo(item.asOf)}</span>
        {item.isStale && <span className="text-moderate">⚠ delayed data</span>}
        {item.isFirstView && <span>new to watchlist</span>}
      </div>
    </div>
  );
}

function CompactRow({ item, onRemove }) {
  const style = TIER_STYLES[item.tier];
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-soft last:border-0 group">
      <div className="flex items-center gap-2.5">
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        <span className="font-mono text-sm font-medium">{item.symbol}</span>
        <span className="text-xs text-text-faint">{item.reasons[0]}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-text-muted">{item.price.toFixed(2)}</span>
        <ChangeBadge pct={item.priceChangePct} />
        <button
          onClick={() => onRemove(item.symbol)}
          className="text-text-faint hover:text-text text-xs opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function DigestSection({ title, items, tier, onRemove, collapsible }) {
  const [open, setOpen] = useState(!collapsible);

  if (items.length === 0) return null;

  if (collapsible) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between text-sm text-text-muted hover:text-text py-2 cursor-pointer"
        >
          <span>{title} · {items.length} stock{items.length !== 1 ? 's' : ''} unchanged</span>
          <span className="font-mono text-xs">{open ? '−' : '+'}</span>
        </button>
        {open && (
          <div className="border border-border rounded-lg px-3 bg-surface">
            {items.map((item) => (
              <CompactRow key={item.symbol} item={item} onRemove={onRemove} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-sm text-text-muted mb-3">{title}</h2>
      {tier === 'high' ? (
        <div className="space-y-3">
          {items.map((item) => (
            <ExpandedCard key={item.symbol} item={item} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-lg px-3 bg-surface">
          {items.map((item) => (
            <CompactRow key={item.symbol} item={item} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
