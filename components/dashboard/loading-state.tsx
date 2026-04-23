export function DashboardLoadingState() {
  return (
    <div className="grid gap-4">
      <div className="panel h-24 animate-pulse bg-slate-900/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel h-72 animate-pulse bg-slate-900/60" />
        <div className="panel h-72 animate-pulse bg-slate-900/60" />
      </div>
    </div>
  );
}
