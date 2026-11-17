import { addDays, startOfDay } from "date-fns";
import type {
  BirthdayBookData,
  CelebrationEvent,
  PlannedNotification,
  ReminderRule,
} from "@/types";
import { atLocalTime, parseYmd } from "@/services/birthday/dates";
import { occasionEvent, personEvent } from "@/services/calendar/events";
import { hashString, stableNotificationId } from "@/lib/utils";

/**
 * Pure reminder planning. Given the data set and "now", produce the exact list
 * of notifications that should be pending with the OS. The platform scheduler
 * then diffs this plan against what the OS reports as pending.
 *
 * Stable keys: `${targetKind}:${targetId}:${eventYear}:${ruleId}` hashed into
 * a 31-bit int. Re-running the planner never creates duplicates – the same
 * reminder always gets the same id – and an edited rule produces a new key,
 * so the old one is cancelled during reconciliation.
 */

export interface PlanOptions {
  now: Date;
  windowDays: number;
  /** Maximum number of pending notifications the platform allows. */
  maxPending: number;
  /** Leave this many slots free for snoozes/tests (iOS has a 64 cap). */
  reserve?: number;
}

export const PLATFORM_LIMITS = {
  ios: 64, // iOS keeps only the soonest 64 pending local notifications per app
  android: 400, // AlarmManager caps an app at 500 alarms; keep headroom
  web: 200,
} as const;

export function notificationKey(
  kind: string,
  targetId: string,
  eventYear: number,
  ruleId: string,
): string {
  return `${kind}:${targetId}:${eventYear}:${ruleId}`;
}

function describe(ev: CelebrationEvent, offset: number): { title: string; body: string } {
  const what = ev.type === "birthday" ? "birthday" : ev.subtitle.toLowerCase();
  const turning = ev.type === "birthday" && ev.turning ? ` (turning ${ev.turning})` : "";
  if (offset === 0) {
    return {
      title: ev.type === "birthday" ? `Today: ${ev.title}'s birthday` : `Today: ${ev.title}`,
      body:
        ev.type === "birthday"
          ? `${ev.title} celebrates today${turning}. Send your wishes.`
          : `${ev.subtitle} is today.`,
    };
  }
  const when = offset === 1 ? "tomorrow" : `in ${offset} days`;
  return {
    title: ev.type === "birthday" ? `${ev.title}'s birthday ${when}` : `${ev.title} ${when}`,
    body:
      ev.type === "birthday"
        ? `${ev.title}'s ${what} is ${when}${turning}. Plan a gift or a card.`
        : `${ev.subtitle} is ${when}.`,
  };
}

function eventsForRule(
  data: BirthdayBookData,
  rule: ReminderRule,
  fromYear: number,
  toYear: number,
): CelebrationEvent[] {
  const leap = data.preferences.leapPolicy;
  const out: CelebrationEvent[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    if (rule.targetKind === "person") {
      const p = data.people.find((x) => x.id === rule.targetId);
      if (!p || p.archived) return [];
      out.push(personEvent(p, y, leap));
    } else {
      const o = data.occasions.find((x) => x.id === rule.targetId);
      if (!o) return [];
      const ev = occasionEvent(o, y, leap);
      if (ev) out.push(ev);
    }
  }
  return out;
}

export function planNotifications(data: BirthdayBookData, opts: PlanOptions): PlannedNotification[] {
  const now = opts.now;
  const horizon = addDays(startOfDay(now), opts.windowDays);
  const planned = new Map<number, PlannedNotification>();

  for (const rule of data.reminders) {
    if (!rule.enabled) continue;

    if (rule.customDate) {
      const day = parseYmd(rule.customDate);
      if (!day) continue;
      const at = atLocalTime(day, rule.time);
      if (at <= now || at > horizon) continue;
      const evs = eventsForRule(data, rule, day.getFullYear(), day.getFullYear() + 1);
      const ev = evs.find((e) => e.date >= startOfDay(day)) ?? evs[0];
      if (!ev) continue;
      const key = notificationKey(rule.targetKind, rule.targetId, ev.year, rule.id);
      const id = stableNotificationId(key);
      const days = Math.round((startOfDay(ev.date).getTime() - startOfDay(day).getTime()) / 86400000);
      const { title, body } = describe(ev, Math.max(0, days));
      planned.set(id, {
        id,
        key,
        title: rule.label ? `${rule.label}: ${ev.title}` : title,
        body,
        at,
        targetKind: rule.targetKind,
        targetId: rule.targetId,
        ruleId: rule.id,
        eventYear: ev.year,
        offsetDays: days,
        channel: days === 0 ? "celebration-day" : "reminders",
      });
      continue;
    }

    const evs = eventsForRule(data, rule, now.getFullYear(), horizon.getFullYear() + 1);
    for (const ev of evs) {
      const fireDay = addDays(ev.date, -rule.offsetDays);
      const at = atLocalTime(fireDay, rule.time);
      if (at <= now || at > horizon) continue;
      const key = notificationKey(rule.targetKind, rule.targetId, ev.year, rule.id);
      const id = stableNotificationId(key);
      const { title, body } = describe(ev, rule.offsetDays);
      planned.set(id, {
        id,
        key,
        title: rule.label ? `${rule.label}: ${ev.title}` : title,
        body,
        at,
        targetKind: rule.targetKind,
        targetId: rule.targetId,
        ruleId: rule.id,
        eventYear: ev.year,
        offsetDays: rule.offsetDays,
        channel: rule.offsetDays === 0 ? "celebration-day" : "reminders",
      });
    }
  }

  const limit = Math.max(0, opts.maxPending - (opts.reserve ?? 0));
  return [...planned.values()].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, limit);
}

/** Diff a plan against what the OS currently holds. */
export function diffSchedule(
  plan: PlannedNotification[],
  pending: Array<{ id: number; at?: Date }>,
): { toSchedule: PlannedNotification[]; toCancel: number[]; unchanged: number[] } {
  const pendingById = new Map(pending.map((p) => [p.id, p]));
  const planIds = new Set(plan.map((p) => p.id));
  const toSchedule: PlannedNotification[] = [];
  const unchanged: number[] = [];
  const toCancel: number[] = [];

  for (const n of plan) {
    const existing = pendingById.get(n.id);
    // Same id but different fire time (e.g. timezone change or edited time): replace it.
    if (existing && (!existing.at || Math.abs(existing.at.getTime() - n.at.getTime()) < 60_000)) {
      unchanged.push(n.id);
    } else {
      if (existing) toCancel.push(n.id);
      toSchedule.push(n);
    }
  }
  for (const p of pending) if (!planIds.has(p.id)) toCancel.push(p.id);
  return { toSchedule, toCancel, unchanged };
}

/** Hash of everything that affects the plan; a change means "needs refresh". */
export function scheduleFingerprint(data: BirthdayBookData): string {
  const relevant = {
    p: data.people.map((p) => [p.id, p.firstName, p.lastName, p.birthMonth, p.birthDay, p.birthYear, p.leapPolicy, p.archived]),
    o: data.occasions.map((o) => [o.id, o.title, o.type, o.month, o.day, o.year, o.recurring]),
    r: data.reminders.map((r) => [r.id, r.targetId, r.offsetDays, r.time, r.enabled, r.customDate, r.label]),
    l: data.preferences.leapPolicy,
    w: data.preferences.scheduleWindowDays,
    x: data.preferences.preciseAlarms,
  };
  return hashString(JSON.stringify(relevant));
}

/** Default reminder rules for a new person/occasion from preferences. */
export function defaultRulesFor(
  targetKind: "person" | "occasion",
  targetId: string,
  offsets: number[],
  time: string,
  makeId: () => string,
): ReminderRule[] {
  const ts = new Date().toISOString();
  return [...new Set(offsets)].sort((a, b) => b - a).map((offsetDays) => ({
    id: makeId(),
    targetKind,
    targetId,
    offsetDays,
    time,
    enabled: true,
    createdAt: ts,
    updatedAt: ts,
  }));
}

export function offsetLabel(offset: number): string {
  if (offset === 0) return "On the day";
  if (offset === 1) return "1 day before";
  if (offset === 7) return "1 week before";
  if (offset === 14) return "2 weeks before";
  if (offset === 30) return "1 month before";
  return `${offset} days before`;
}
