export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-[var(--bg-subtle)]" />
        <div className="h-4 w-80 rounded bg-[var(--bg-subtle)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        ))}
      </div>
      <div className="h-72 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
    </div>
  );
}
