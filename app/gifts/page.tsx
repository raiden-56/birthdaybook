"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Gift as GiftIcon, Plus, Wallet } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar, Button, Card, CardHeader, EmptyState, Input, PageHeader, Segmented, Select, Spinner, Stat } from "@/components/ui/primitives";
import { GiftRow } from "@/components/gifts/GiftEditor";
import { GIFT_STATUS_LABEL, giftSummary, nextGiftStatus } from "@/services/gifts/gifts";
import { upcomingEvents } from "@/services/calendar/events";
import { formatMoney, fullName } from "@/lib/utils";
import { GIFT_STATUSES, type GiftStatus } from "@/types";

export default function GiftsPage() {
  const { ready, data, repo, toast } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState<"all" | GiftStatus>("all");
  const [personId, setPersonId] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");

  const upcoming = useMemo(() => upcomingEvents(data, now, 60).filter((e) => e.kind === "person"), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = giftSummary(data, year, upcoming.filter((e) => e.year === year).map((e) => e.targetId));
  const gifts = data.gifts.filter((g) => g.year === year && (status === "all" || g.status === status));
  const needGift = upcoming.filter((e) => !data.gifts.some((g) => g.personId === e.targetId && g.year === e.year));
  const years = [...new Set([now.getFullYear(), now.getFullYear() + 1, ...data.gifts.map((g) => g.year)])].sort((a, b) => b - a);
  const cur = data.preferences.currency;
  const nameOf = (id: string) => {
    const p = data.people.find((x) => x.id === id);
    return p ? fullName(p) : "Unknown";
  };

  if (!ready) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Gift planner"
        title="Gifts"
        description="Ideas, budgets and what's still to buy."
        actions={
          <Select aria-label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Gifts" value={summary.count} icon={GiftIcon} />
        <Stat label="Budgeted" value={formatMoney(summary.budget, cur)} icon={Wallet} />
        <Stat label="Spent" value={formatMoney(summary.spent, cur)} hint={summary.budget ? `${Math.round((summary.spent / summary.budget) * 100)}% of budget` : undefined} />
        <Stat label="Given" value={summary.byStatus.given} hint={`${summary.byStatus.idea} still ideas`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={`All gifts for ${year}`} icon={GiftIcon} />
          <div className="px-5 pb-5">
            <form
              className="mb-4 grid gap-2 sm:grid-cols-[1fr_1.2fr_0.7fr_auto]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!personId || !title.trim()) return;
                await repo.addGift({ personId, title: title.trim(), status: "idea", budget: budget ? Number(budget) : undefined, year });
                setTitle("");
                setBudget("");
                toast({ tone: "success", title: "Gift added" });
              }}
            >
              <Select aria-label="For" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">For…</option>
                {[...data.people].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((p) => (
                  <option key={p.id} value={p.id}>
                    {fullName(p)}
                  </option>
                ))}
              </Select>
              <Input aria-label="Gift" placeholder="Gift idea" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input aria-label="Budget" placeholder="Budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
              <Button type="submit" icon={Plus} disabled={!personId || !title.trim()}>
                Add
              </Button>
            </form>
            <div className="-mx-1 mb-3 overflow-x-auto px-1 scrollbar-none">
              <Segmented
                label="Filter by status"
                value={status}
                onChange={setStatus}
                options={[{ value: "all" as const, label: "All" }, ...GIFT_STATUSES.map((s) => ({ value: s, label: `${GIFT_STATUS_LABEL[s]} ${summary.byStatus[s] || ""}`.trim() }))]}
              />
            </div>
            {gifts.length === 0 ? (
              <EmptyState icon={GiftIcon} title="No gifts here" body="Add an idea above, or from someone's profile." />
            ) : (
              <ul className="space-y-2">
                {gifts.map((g) => (
                  <GiftRow key={g.id} gift={g} currency={cur} personName={nameOf(g.personId)} onAdvance={() => repo.upsert("gifts", { ...g, status: nextGiftStatus(g.status) })} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Still need a gift" description="Celebrations in the next 60 days" icon={Wallet} />
          <ul className="px-3 pb-4">
            {needGift.length === 0 ? (
              <li className="px-2 py-3 text-sm text-ink-muted">Everyone coming up is covered.</li>
            ) : (
              needGift.map((ev) => {
                const p = data.people.find((x) => x.id === ev.targetId)!;
                return (
                  <li key={ev.key}>
                    <Link href={`/person/?id=${p.id}#gifts`} className="flex min-h-14 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                      <Avatar person={p} size={38} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{fullName(p)}</span>
                      <span className="text-sm text-ink-muted">{format(ev.date, "d MMM")}</span>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
