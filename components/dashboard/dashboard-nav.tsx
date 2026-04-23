"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/search", label: "Search" },
  { href: "/dashboard/politician", label: "Politician" },
  { href: "/dashboard/comparison", label: "Statement vs Vote" },
  { href: "/dashboard/donors", label: "Donors" },
  { href: "/dashboard/wealth", label: "Wealth" },
  { href: "/dashboard/impact", label: "Impact" },
  { href: "/dashboard/methodology", label: "Methodology" }
] as const;

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const personSlug = searchParams.get("person");

  return (
    <ul className="flex min-w-max items-center gap-2 px-4 py-3 sm:px-6">
      {navItems.map((item) => {
        const active = pathname === item.href;
        // Preserve ?person= across tabs so switching tabs keeps
        // the selected politician in context. Search tab is excluded.
        const href =
          personSlug && item.href !== "/dashboard/search"
            ? `${item.href}?person=${encodeURIComponent(personSlug)}`
            : item.href;

        return (
          <li key={item.href}>
            <Link
              href={href as Route}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition",
                active
                  ? "border-civic-200/60 bg-civic-600/30 text-civic-100"
                  : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-civic-400/40 hover:text-white"
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardNav() {
  return (
    <nav className="overflow-x-auto">
      <Suspense
        fallback={
          <ul className="flex min-w-max items-center gap-2 px-4 py-3 sm:px-6">
            {navItems.map((item) => (
              <li key={item.href}>
                <span className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        }
      >
        <NavLinks />
      </Suspense>
    </nav>
  );
}
