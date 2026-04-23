import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  message
}: {
  icon: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <section className="panel p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-civic-600/20 text-civic-100">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{message}</p>
    </section>
  );
}
