"use client";

import Link from "next/link";
import { ChevronRight, Heart } from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";
import { NAV_DATA, NAV_PLAN } from "@/components/layout/AppShell";

const SECTIONS = [
  { title: "Celebrate", items: [{ href: "/occasions/", label: "Occasions", icon: Heart }, ...NAV_PLAN] },
  { title: "Data", items: NAV_DATA },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" />
      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">{s.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {s.items.map((i) => {
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link href={i.href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-surface-2">
                      <span className="grid size-9 place-items-center rounded-xl bg-plum-soft text-plum">
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="flex-1 text-[15px] font-medium text-ink">{i.label}</span>
                      <ChevronRight className="size-4 text-ink-faint" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
