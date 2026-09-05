export default function EmptyState() {
  return (
    <div className="mt-10 border border-dashed border-border rounded-lg py-12 px-6 text-center">
      <div className="text-text-muted text-sm">
        Your watchlist is empty.
      </div>
      <div className="text-text-faint text-xs mt-1">
        Add a symbol above — pick one of the suggestions to see it in action.
      </div>
    </div>
  );
}
