import { AlertTriangle, Database } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

export function MissingDatabaseState() {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={Database}
        title="Database Is Not Configured"
        message="Set DATABASE_URL and DIRECT_URL in .env.local to connect Prisma to PostgreSQL/Supabase."
      />
      <code className="block rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200">
        DATABASE_URL=...{"\n"}
        DIRECT_URL=...{"\n"}
        npm run db:push{"\n"}
        npm run db:seed
      </code>
    </div>
  );
}

export function EmptyDatasetState() {
  return (
    <div className="space-y-4">
      <EmptyState
        icon={AlertTriangle}
        title="No Dataset Loaded"
        message="Database connection is configured but no records were found for dashboard rendering."
      />
      <code className="block rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-200">
        npm run db:seed
      </code>
    </div>
  );
}
