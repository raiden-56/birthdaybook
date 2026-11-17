import { startOfDay } from "date-fns";
import type { BirthdayBookData, CelebrationEvent, LeapPolicy, Occasion, Person } from "@/types";
import {
  ageInYear,
  anniversaryName,
  daysUntil,
  isAnniversaryMilestone,
  isBirthdayMilestone,
  observedDate,
} from "@/services/birthday/dates";
import { fullName, ordinal } from "@/lib/utils";

export const OCCASION_LABEL: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  wedding: "Wedding anniversary",
  "work-anniversary": "Work anniversary",
  memorial: "Remembrance",
  graduation: "Graduation",
  custom: "Occasion",
};

export function personEvent(p: Person, year: number, leap: LeapPolicy): CelebrationEvent {
  const { date, shifted } = observedDate(p.birthMonth, p.birthDay, year, p.leapPolicy ?? leap);
  const turning = ageInYear(p.birthYear, year);
  return {
    key: `person:${p.id}:${year}`,
    kind: "person",
    targetId: p.id,
    title: fullName(p),
    subtitle: turning != null && turning > 0 ? `Turns ${turning}` : "Birthday",
    type: "birthday",
    date,
    year,
    turning: turning && turning > 0 ? turning : undefined,
    isMilestone: isBirthdayMilestone(turning),
    personIds: [p.id],
    shiftedFromLeapDay: shifted,
  };
}

export function occasionEvent(
  o: Occasion,
  year: number,
  leap: LeapPolicy,
): CelebrationEvent | undefined {
  if (!o.recurring && o.year != null && o.year !== year) return undefined;
  if (o.recurring && o.year != null && year < o.year) return undefined;
  const { date, shifted } = observedDate(o.month, o.day, year, leap);
  const years = o.recurring && o.year != null ? year - o.year : undefined;
  const label = OCCASION_LABEL[o.type] ?? "Occasion";
  let subtitle = label;
  if (years != null && years > 0) {
    const named = anniversaryName(years);
    subtitle =
      o.type === "memorial"
        ? `${years} years`
        : `${ordinal(years)} ${label.toLowerCase()}${named ? ` · ${named}` : ""}`;
  }
  return {
    key: `occasion:${o.id}:${year}`,
    kind: "occasion",
    targetId: o.id,
    title: o.title,
    subtitle,
    type: o.type,
    date,
    year,
    turning: years && years > 0 ? years : undefined,
    isMilestone: o.type !== "memorial" && isAnniversaryMilestone(years),
    personIds: o.personIds,
    shiftedFromLeapDay: shifted,
  };
}

/** All celebration events whose observed date falls within [start, end] inclusive. */
export function eventsInRange(data: BirthdayBookData, start: Date, end: Date): CelebrationEvent[] {
  const s = startOfDay(start);
  const e = startOfDay(end);
  const leap = data.preferences.leapPolicy;
  const out: CelebrationEvent[] = [];
  for (let y = s.getFullYear(); y <= e.getFullYear(); y++) {
    for (const p of data.people) {
      if (p.archived) continue;
      const ev = personEvent(p, y, leap);
      if (ev.date >= s && ev.date <= e) out.push(ev);
    }
    for (const o of data.occasions) {
      const ev = occasionEvent(o, y, leap);
      if (ev && ev.date >= s && ev.date <= e) out.push(ev);
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
}

export function upcomingEvents(data: BirthdayBookData, from: Date, days: number): CelebrationEvent[] {
  const s = startOfDay(from);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + days);
  return eventsInRange(data, s, e);
}

/** Group events by local YYYY-MM-DD for fast calendar lookups. */
export function groupByDay(events: CelebrationEvent[]): Map<string, CelebrationEvent[]> {
  const map = new Map<string, CelebrationEvent[]>();
  for (const ev of events) {
    const k = `${ev.date.getFullYear()}-${ev.date.getMonth()}-${ev.date.getDate()}`;
    const list = map.get(k) ?? [];
    list.push(ev);
    map.set(k, list);
  }
  return map;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function countdownLabel(date: Date, from: Date = new Date()): string {
  const n = daysUntil(date, from);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return `In ${n} days`;
  if (n < 14) return "Next week";
  if (n < 60) return `In ${Math.round(n / 7)} weeks`;
  return `In ${Math.round(n / 30)} months`;
}

/** Look up a person or occasion by event target. */
export function findTarget(data: BirthdayBookData, kind: "person" | "occasion", id: string) {
  return kind === "person"
    ? data.people.find((p) => p.id === id)
    : data.occasions.find((o) => o.id === id);
}

export function nextEventFor(
  data: BirthdayBookData,
  kind: "person" | "occasion",
  id: string,
  from: Date = new Date(),
): CelebrationEvent | undefined {
  const leap = data.preferences.leapPolicy;
  const today = startOfDay(from);
  for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) {
    let ev: CelebrationEvent | undefined;
    if (kind === "person") {
      const p = data.people.find((x) => x.id === id);
      if (!p) return undefined;
      ev = personEvent(p, y, leap);
    } else {
      const o = data.occasions.find((x) => x.id === id);
      if (!o) return undefined;
      ev = occasionEvent(o, y, leap);
    }
    if (ev && ev.date >= today) return ev;
  }
  return undefined;
}
