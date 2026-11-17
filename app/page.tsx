"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  Cake,
  CalendarDays,
  Check,
  FileSpreadsheet,
  Gift,
  Hourglass,
  MessageCircleHeart,
  Palette,
  PartyPopper,
  Sparkles,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Spinner, Stat } from "@/components/ui/primitives";
import { EventRow, eventHref } from "@/components/events/EventRow";
import { EventSheet } from "@/components/events/EventSheet";
import { PersonForm } from "@/components/people/PersonForm";
import { HEALTH_META } from "@/components/reminders/HealthBadge";
import { upcomingEvents } from "@/services/calendar/events";
import { belatedCandidates, upcomingMilestones, wishFor } from "@/services/birthday/insights";
import { daysUntil } from "@/services/birthday/dates";
import { giftSummary } from "@/services/gifts/gifts";
import { formatMoney, cn } from "@/lib/utils";
import { loadSampleData } from "@/lib/sample";
import type { CelebrationEvent } from "@/types";

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { ready, data, repo, health, requestPermission, reconcile, platform, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<CelebrationEvent | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const now = useMemo(() => new Date(), []);

  const upcoming = useMemo(() => upcomingEvents(data, now, 60), [data, now]);
  const today = upcoming.filter((e) => daysUntil(e.date, now) === 0);
  const next = upcoming.find((e) => daysUntil(e.date, now) > 0);
  const soon = upcoming.filter((e) => daysUntil(e.date, now) > 0).slice(0, 8);
  const belated = useMemo(() => belatedCandidates(data, now), [data, now]);
  const milestones = useMemo(() => upcomingMilestones(data, now, 365).slice(0, 4), [data, now]);
  const gifts = giftSummary(data, now.getFullYear(), upcoming.filter((e) => e.kind === "person").map((e) => e.targetId));
  const thisMonth = upcoming.filter((e) => e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()).length;

  if (!ready) return <Spinner label="Opening your BirthdayBook" />;

  if (data.people.length === 0 && data.occasions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-coral-ink uppercase">Welcome</p>
        <h1 className="text-4xl leading-tight font-semibold text-ink text-balance sm:text-5xl">Never miss the days that matter.</h1>
        <p className="mt-3 max-w-xl text-lg text-ink-muted">
          BirthdayBook keeps birthdays, anniversaries and the little details about your people on this device. No account, no cloud.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/data/" className="group rounded-2xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-plum/40">
            <FileSpreadsheet className="mb-3 size-6 text-green-ink" aria-hidden />
            <p className="font-semibold text-ink">Import from Excel</p>
            <p className="mt-1 text-sm text-ink-muted">Bring in a spreadsheet or CSV. You&apos;ll check a preview first.</p>
          </Link>
          <button onClick={() => setAdding(true)} className="rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-plum/40">
            <UserPlus className="mb-3 size-6 text-plum" aria-hidden />
            <p className="font-semibold text-ink">Add someone</p>
            <p className="mt-1 text-sm text-ink-muted">Name and birthday are all you need.</p>
          </button>
          <button
            disabled={loadingSample}
            onClick={async () => {
              setLoadingSample(true);
              await loadSampleData(repo);
              setLoadingSample(false);
              toast({ tone: "success", title: "Sample data loaded", body: "Delete it any time from Settings." });
            }}
            className="rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition-colors hover:border-plum/40 disabled:opacity-60"
          >
            <Wand2 className="mb-3 size-6 text-coral-ink" aria-hidden />
            <p className="font-semibold text-ink">Try with sample data</p>
            <p className="mt-1 text-sm text-ink-muted">Explore the calendar with a dozen made-up people.</p>
          </button>
        </div>
        <PersonForm open={adding} onClose={() => setAdding(false)} />
      </div>
    );
  }

  const hm = HEALTH_META[health];
  const HealthIcon = hm.icon;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink-muted">{format(now, "EEEE, d MMMM")}</p>
          <h1 className="mt-1 text-[30px] leading-tight font-semibold text-ink sm:text-4xl">{greeting(now)}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={UserPlus} onClick={() => setAdding(true)}>
            Add person
          </Button>
          <ButtonLink href="/calendar/" variant="primary" icon={CalendarDays}>
            Calendar
          </ButtonLink>
        </div>
      </header>

      {/* Reminder health — only when action is needed */}
      {health !== "enabled" && (
        <Card className="flex flex-col gap-3 border-coral/40 bg-coral-soft/40 p-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-coral-ink">
            <HealthIcon className="size-5" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-ink">{hm.label}</p>
            <p className="text-sm text-ink-muted">{hm.body}</p>
          </div>
          {health === "permission-required" && (
            <Button
              onClick={async () => {
                const p = await requestPermission();
                if (p === "granted") toast({ tone: "success", title: "Reminders are on" });
              }}
            >
              Allow notifications
            </Button>
          )}
          {health === "needs-refresh" && <Button onClick={() => reconcile("dashboard")}>Refresh schedule</Button>}
          {(health === "disabled" || health === "unsupported") && (
            <ButtonLink href="/alarms/" variant="secondary">
              {platform === "web" ? "See options" : "How to fix"}
            </ButtonLink>
          )}
        </Card>
      )}

      {/* Today */}
      {today.length > 0 && (
        <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="overflow-hidden rounded-[1.5rem] bg-plum p-5 text-on-plum shadow-float sm:p-7">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <PartyPopper className="size-4" aria-hidden /> Today
          </div>
          <ul className="mt-3 space-y-3">
            {today.map((ev) => {
              const w = wishFor(data, ev);
              const wished = w && w.status !== "pending";
              return (
                <li key={ev.key} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold sm:text-3xl">{ev.title}</p>
                    <p className="opacity-85">{ev.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wished ? (
                      <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium">
                        <Check className="size-4" aria-hidden /> Wished
                      </span>
                    ) : (
                      <button onClick={() => setSelected(ev)} className="h-10 rounded-xl bg-[#FAF9F6] px-4 text-sm font-semibold text-[#563B5C]">
                        Mark as wished
                      </button>
                    )}
                    <Link href={`/messages/?target=${ev.kind}:${ev.targetId}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium hover:bg-white/25">
                      <MessageCircleHeart className="size-4" aria-hidden /> Message
                    </Link>
                    <Link href={`/cards/?target=${ev.kind}:${ev.targetId}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium hover:bg-white/25">
                      <Palette className="size-4" aria-hidden /> Card
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          {/* Next up countdown */}
          {next && (
            <Card className="overflow-hidden">
              <Link href={eventHref(next)} className="flex items-center gap-5 p-5 sm:p-6">
                <div className="flex size-24 shrink-0 flex-col items-center justify-center rounded-[1.25rem] bg-lavender text-plum sm:size-28">
                  <span className="font-display text-4xl leading-none font-semibold tabular-nums sm:text-5xl">{daysUntil(next.date, now)}</span>
                  <span className="mt-1 text-xs font-semibold tracking-wider uppercase">{daysUntil(next.date, now) === 1 ? "day" : "days"}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.12em] text-coral-ink uppercase">Next up</p>
                  <p className="mt-1 truncate font-display text-2xl font-semibold text-ink sm:text-[28px]">{next.title}</p>
                  <p className="text-ink-muted">
                    {next.subtitle} · {format(next.date, "EEEE d MMMM")}
                  </p>
                  {next.isMilestone && (
                    <Badge tone="amber" icon={Sparkles} className="mt-2">
                      Milestone
                    </Badge>
                  )}
                </div>
                <ArrowRight className="ml-auto hidden size-5 shrink-0 text-ink-faint sm:block" aria-hidden />
              </Link>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Coming up"
              description="Next 60 days"
              icon={Cake}
              action={
                <Link href="/calendar/?view=agenda" className="text-sm font-medium text-plum hover:underline">
                  See all
                </Link>
              }
            />
            <div className="px-2 pb-3">
              {soon.length === 0 ? (
                <EmptyState icon={CalendarDays} title="A quiet couple of months" body="Nothing in the next 60 days." />
              ) : (
                <ul>
                  {soon.map((ev) => (
                    <li key={ev.key}>
                      <EventRow ev={ev} now={now} onClick={() => setSelected(ev)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="This month" value={thisMonth} icon={CalendarDays} />
            <Stat label="People" value={data.people.filter((p) => !p.archived).length} icon={UserPlus} />
          </div>

          {belated.length > 0 && (
            <Card>
              <CardHeader title="Belated assistant" description="Missed recently? It's not too late." icon={Hourglass} />
              <ul className="px-2 pb-3">
                {belated.slice(0, 4).map((ev) => (
                  <li key={ev.key} className="flex items-center gap-2 pr-2">
                    <div className="min-w-0 flex-1">
                      <EventRow ev={ev} now={now} compact onClick={() => setSelected(ev)} />
                    </div>
                    <ButtonLink href={`/messages/?target=${ev.kind}:${ev.targetId}&tone=belated`} size="sm" variant="soft">
                      Write
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {milestones.length > 0 && (
            <Card>
              <CardHeader title="Milestones ahead" description="Big birthdays and anniversaries this year" icon={Sparkles} />
              <ul className="space-y-1 px-5 pb-5">
                {milestones.map((ev) => (
                  <li key={ev.key}>
                    <Link href={eventHref(ev)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 hover:bg-surface-2">
                      <span className="truncate text-[15px] text-ink">{ev.title}</span>
                      <span className="shrink-0 text-sm text-ink-muted">
                        <span className="font-display text-lg font-semibold text-plum">{ev.turning}</span> · {format(ev.date, "d MMM")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Gift planner"
              description={`${now.getFullYear()} so far`}
              icon={Gift}
              action={
                <Link href="/gifts/" className="text-sm font-medium text-plum hover:underline">
                  Open
                </Link>
              }
            />
            <div className="grid grid-cols-3 gap-2 px-5 pb-5 text-center">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="font-display text-2xl font-semibold text-ink">{gifts.count}</p>
                <p className="text-xs text-ink-muted">Gifts</p>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="truncate font-display text-xl font-semibold text-ink">{formatMoney(gifts.spent, data.preferences.currency)}</p>
                <p className="text-xs text-ink-muted">Spent</p>
              </div>
              <div className={cn("rounded-xl p-3", gifts.peopleWithoutGift ? "bg-coral-soft" : "bg-surface-2")}>
                <p className="font-display text-2xl font-semibold text-ink">{gifts.peopleWithoutGift}</p>
                <p className="text-xs text-ink-muted">Need a gift</p>
              </div>
            </div>
          </Card>

          {health === "enabled" && (
            <Link href="/alarms/" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-plum/40">
              <span className="grid size-10 place-items-center rounded-xl bg-green-soft text-green-ink">
                <BellRing className="size-5" aria-hidden />
              </span>
              <div className="flex-1">
                <p className="font-medium text-ink">Reminders are on</p>
                <p className="text-sm text-ink-muted">{platform === "web" ? "Browser notifications while BirthdayBook is open" : "Booked with your phone's notification system"}</p>
              </div>
              <ArrowRight className="size-4 text-ink-faint" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <PersonForm open={adding} onClose={() => setAdding(false)} />
      <EventSheet ev={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
