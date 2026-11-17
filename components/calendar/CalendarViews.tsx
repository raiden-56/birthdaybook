"use client";

import { useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Cake, Heart, Sparkles } from "lucide-react";
import type { CelebrationEvent } from "@/types";
import { cn, avatarTone } from "@/lib/utils";
import { dayKey } from "@/services/calendar/events";
import { EventRow } from "@/components/events/EventRow";
import { MONTHS } from "@/lib/labels";

export type CalendarView = "month" | "week" | "day" | "agenda" | "year";

function weekdayLabels(weekStartsOn: 0 | 1) {
  const base = startOfWeek(new Date(2026, 0, 7), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), "EEE"));
}

function Chip({ ev, onClick }: { ev: CelebrationEvent; onClick: () => void }) {
  const isBirthday = ev.type === "birthday";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-xs font-medium transition-[filter] hover:brightness-95",
        isBirthday ? avatarTone(ev.targetId) : "bg-coral-soft text-coral-ink",
      )}
      title={`${ev.title} · ${ev.subtitle}`}
    >
      {ev.isMilestone ? <Sparkles className="size-3 shrink-0" aria-hidden /> : isBirthday ? <Cake className="size-3 shrink-0" aria-hidden /> : <Heart className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{ev.title.split(" ")[0]}</span>
      {ev.turning && <span className="ml-auto shrink-0 opacity-75 tabular-nums">{ev.turning}</span>}
    </button>
  );
}

/* ---------------- Month ---------------- */

export function MonthView({
  cursor,
  events,
  selected,
  onSelectDay,
  onOpenEvent,
  weekStartsOn,
}: {
  cursor: Date;
  events: Map<string, CelebrationEvent[]>;
  selected: Date;
  onSelectDay: (d: Date) => void;
  onOpenEvent: (ev: CelebrationEvent) => void;
  weekStartsOn: 0 | 1;
}) {
  const today = new Date();
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn }),
      }),
    [cursor, weekStartsOn],
  );

  return (
    <div role="grid" aria-label={format(cursor, "MMMM yyyy")} className="overflow-hidden rounded-[1.25rem] border border-line bg-surface">
      <div role="row" className="grid grid-cols-7 border-b border-line bg-surface-2/60">
        {weekdayLabels(weekStartsOn).map((d) => (
          <div key={d} role="columnheader" className="py-2.5 text-center text-xs font-semibold tracking-wider text-ink-muted uppercase">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const evs = events.get(dayKey(day)) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const isSel = isSameDay(day, selected);
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-selected={isSel}
              tabIndex={isSel ? 0 : -1}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
                if (step) {
                  e.preventDefault();
                  onSelectDay(addDays(day, step));
                } else if (e.key === "Enter" && evs[0]) onOpenEvent(evs[0]);
              }}
              aria-label={`${format(day, "EEEE d MMMM")}${evs.length ? `, ${evs.length} celebration${evs.length > 1 ? "s" : ""}` : ""}`}
              className={cn(
                "group relative flex min-h-[3.4rem] cursor-pointer flex-col gap-1 border-line p-1 outline-none transition-colors sm:min-h-[6.75rem] sm:p-1.5",
                i % 7 !== 6 && "border-r",
                i < days.length - 7 && "border-b",
                !inMonth && "bg-surface-2/40",
                isSel ? "bg-lavender/60 dark:bg-plum-soft" : "hover:bg-surface-2/70",
                "focus-visible:ring-2 focus-visible:ring-plum focus-visible:ring-inset",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center self-center rounded-full text-sm tabular-nums sm:self-start",
                  isToday ? "bg-plum font-semibold text-on-plum" : inMonth ? "text-ink" : "text-ink-faint",
                )}
              >
                {format(day, "d")}
              </span>
              {/* Phone: dots. Tablet/desktop: chips. */}
              {evs.length > 0 && (
                <>
                  <div className="flex justify-center gap-0.5 sm:hidden" aria-hidden>
                    {evs.slice(0, 3).map((ev) => (
                      <span key={ev.key} className={cn("size-1.5 rounded-full", ev.type === "birthday" ? "bg-plum" : "bg-coral")} />
                    ))}
                  </div>
                  <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {evs.slice(0, 3).map((ev) => (
                      <Chip key={ev.key} ev={ev} onClick={() => onOpenEvent(ev)} />
                    ))}
                    {evs.length > 3 && <span className="px-1.5 text-xs font-medium text-ink-muted">+{evs.length - 3} more</span>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Week ---------------- */

export function WeekView({
  cursor,
  events,
  onOpenEvent,
  weekStartsOn,
}: {
  cursor: Date;
  events: Map<string, CelebrationEvent[]>;
  onOpenEvent: (ev: CelebrationEvent) => void;
  weekStartsOn: 0 | 1;
}) {
  const start = startOfWeek(cursor, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const evs = events.get(dayKey(day)) ?? [];
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} className={cn("rounded-2xl border bg-surface p-3 md:min-h-64", isToday ? "border-plum" : "border-line")}>
            <div className="mb-2 flex items-baseline gap-2 md:flex-col md:gap-0">
              <span className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{format(day, "EEE")}</span>
              <span className={cn("font-display text-2xl font-semibold", isToday ? "text-plum" : "text-ink")}>{format(day, "d")}</span>
              <span className="text-sm text-ink-muted md:hidden">{format(day, "MMMM")}</span>
            </div>
            {evs.length === 0 ? (
              <p className="text-sm text-ink-faint">—</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {evs.map((ev) => (
                  <button
                    key={ev.key}
                    onClick={() => onOpenEvent(ev)}
                    className={cn("rounded-xl p-2 text-left text-sm transition-[filter] hover:brightness-95", ev.type === "birthday" ? avatarTone(ev.targetId) : "bg-coral-soft text-coral-ink")}
                  >
                    <p className="truncate font-semibold">{ev.title}</p>
                    <p className="truncate text-xs opacity-80">{ev.subtitle}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Day ---------------- */

export function DayView({ cursor, events, onOpenEvent }: { cursor: Date; events: Map<string, CelebrationEvent[]>; onOpenEvent: (ev: CelebrationEvent) => void }) {
  const evs = events.get(dayKey(cursor)) ?? [];
  return (
    <div className="rounded-[1.25rem] border border-line bg-surface p-5 sm:p-8">
      <p className="text-sm font-semibold tracking-wider text-coral-ink uppercase">{format(cursor, "EEEE")}</p>
      <p className="font-display text-5xl font-semibold text-ink sm:text-6xl">{format(cursor, "d MMMM")}</p>
      <p className="mt-1 text-ink-muted">{format(cursor, "yyyy")}</p>
      <div className="mt-6">
        {evs.length === 0 ? (
          <p className="text-ink-muted">No celebrations on this day.</p>
        ) : (
          <ul className="-mx-3">
            {evs.map((ev) => (
              <li key={ev.key}>
                <EventRow ev={ev} onClick={() => onOpenEvent(ev)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Agenda ---------------- */

export function AgendaView({ list, onOpenEvent }: { list: CelebrationEvent[]; onOpenEvent: (ev: CelebrationEvent) => void }) {
  const groups = useMemo(() => {
    const g = new Map<string, CelebrationEvent[]>();
    for (const ev of list) {
      const k = format(ev.date, "MMMM yyyy");
      g.set(k, [...(g.get(k) ?? []), ev]);
    }
    return [...g.entries()];
  }, [list]);
  if (!list.length) return <p className="py-10 text-center text-ink-muted">Nothing scheduled in the next 12 months.</p>;
  return (
    <div className="space-y-6">
      {groups.map(([month, evs]) => (
        <section key={month}>
          <h3 className="sticky top-14 z-10 -mx-1 bg-canvas/90 px-1 py-2 font-display text-xl font-semibold text-ink backdrop-blur lg:top-0">
            {month} <span className="text-base font-normal text-ink-muted">· {evs.length}</span>
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface px-1">
            {evs.map((ev) => (
              <li key={ev.key}>
                <EventRow ev={ev} onClick={() => onOpenEvent(ev)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Year ---------------- */

export function YearView({
  year,
  events,
  onPickMonth,
  weekStartsOn,
}: {
  year: number;
  events: Map<string, CelebrationEvent[]>;
  onPickMonth: (m: number) => void;
  weekStartsOn: 0 | 1;
}) {
  const today = new Date();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MONTHS.map((name, m) => {
        const first = new Date(year, m, 1);
        const days = eachDayOfInterval({ start: startOfWeek(first, { weekStartsOn }), end: endOfWeek(endOfMonth(first), { weekStartsOn }) });
        const count = days.filter((d) => d.getMonth() === m).reduce((n, d) => n + (events.get(dayKey(d))?.length ?? 0), 0);
        return (
          <button key={name} onClick={() => onPickMonth(m)} className="rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-plum/40" aria-label={`${name} ${year}, ${count} celebrations`}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-lg font-semibold text-ink">{name}</span>
              <span className="text-xs font-medium text-ink-muted">{count || ""}</span>
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]" aria-hidden>
              {days.map((d) => {
                const n = events.get(dayKey(d))?.length ?? 0;
                const inMonth = d.getMonth() === m;
                return (
                  <span
                    key={d.toISOString()}
                    className={cn(
                      "mx-auto grid size-6 place-items-center rounded-full tabular-nums",
                      !inMonth && "opacity-0",
                      n > 0 && (n > 1 ? "bg-plum text-on-plum" : "bg-lavender text-plum dark:bg-plum-soft"),
                      isSameDay(d, today) && "ring-2 ring-coral",
                      n === 0 && "text-ink-muted",
                    )}
                  >
                    {format(d, "d")}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
