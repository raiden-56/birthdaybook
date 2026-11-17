import { addDays, startOfDay } from "date-fns";
import type { BirthdayBookData, CelebrationEvent, Relationship } from "@/types";
import { RELATIONSHIPS } from "@/types";
import { eventsInRange, upcomingEvents } from "@/services/calendar/events";
import { currentAge, zodiacSign } from "./dates";

export function wishFor(data: BirthdayBookData, ev: CelebrationEvent) {
  return data.wishes.find((w) => w.targetKind === ev.kind && w.targetId === ev.targetId && w.year === ev.year);
}

/** Celebrations in the last N days where no wish has been recorded yet. */
export function belatedCandidates(data: BirthdayBookData, now = new Date()): CelebrationEvent[] {
  const today = startOfDay(now);
  const from = addDays(today, -data.preferences.belatedWindowDays);
  return eventsInRange(data, from, addDays(today, -1))
    .filter((ev) => ev.type !== "memorial")
    .filter((ev) => {
      const w = wishFor(data, ev);
      return !w || w.status === "pending";
    })
    .reverse();
}

export function upcomingMilestones(data: BirthdayBookData, now = new Date(), days = 365): CelebrationEvent[] {
  return upcomingEvents(data, now, days).filter((e) => e.isMilestone);
}

export interface Stats {
  total: number;
  byMonth: number[];
  byRelationship: Record<Relationship, number>;
  ageBuckets: Array<{ label: string; count: number }>;
  withYear: number;
  averageAge?: number;
  busiestMonth?: number;
  thisMonth: number;
  next30: number;
  wishesSentThisYear: number;
  wishesMissedThisYear: number;
  zodiac: Record<string, number>;
  occasions: number;
  favourites: number;
}

export function computeStats(data: BirthdayBookData, now = new Date()): Stats {
  const people = data.people.filter((p) => !p.archived);
  const byMonth = Array(12).fill(0) as number[];
  const byRelationship = Object.fromEntries(RELATIONSHIPS.map((r) => [r, 0])) as Record<Relationship, number>;
  const buckets = [
    { label: "0–17", min: 0, max: 17, count: 0 },
    { label: "18–29", min: 18, max: 29, count: 0 },
    { label: "30–44", min: 30, max: 44, count: 0 },
    { label: "45–59", min: 45, max: 59, count: 0 },
    { label: "60+", min: 60, max: 200, count: 0 },
  ];
  const zodiac: Record<string, number> = {};
  let ageSum = 0;
  let withYear = 0;
  for (const p of people) {
    byMonth[p.birthMonth - 1]++;
    byRelationship[p.relationship]++;
    const z = zodiacSign(p.birthMonth, p.birthDay);
    zodiac[z] = (zodiac[z] ?? 0) + 1;
    const age = currentAge(p.birthYear, p.birthMonth, p.birthDay, now, p.leapPolicy ?? data.preferences.leapPolicy);
    if (age != null) {
      withYear++;
      ageSum += age;
      const b = buckets.find((x) => age >= x.min && age <= x.max);
      if (b) b.count++;
    }
  }
  const max = Math.max(...byMonth);
  const year = now.getFullYear();
  const wishesThisYear = data.wishes.filter((w) => w.year === year);
  return {
    total: people.length,
    byMonth,
    byRelationship,
    ageBuckets: buckets.map(({ label, count }) => ({ label, count })),
    withYear,
    averageAge: withYear ? Math.round((ageSum / withYear) * 10) / 10 : undefined,
    busiestMonth: max > 0 ? byMonth.indexOf(max) : undefined,
    thisMonth: byMonth[now.getMonth()],
    next30: upcomingEvents(data, now, 30).length,
    wishesSentThisYear: wishesThisYear.filter((w) => w.status === "sent" || w.status === "belated").length,
    wishesMissedThisYear: wishesThisYear.filter((w) => w.status === "skipped").length,
    zodiac,
    occasions: data.occasions.length,
    favourites: people.filter((p) => p.favorite).length,
  };
}
