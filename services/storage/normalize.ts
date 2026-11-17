import type {
  BirthdayBookData,
  ChecklistItem,
  Gift,
  Note,
  Occasion,
  Person,
  Preferences,
  ReminderRule,
  Wish,
} from "@/types";
import {
  DEFAULT_PREFERENCES,
  GIFT_STATUSES,
  NOTE_KINDS,
  OCCASION_TYPES,
  RELATIONSHIPS,
  WISH_CHANNELS,
} from "@/types";
import { isValidMonthDay } from "@/services/birthday/dates";
import { nowIso, uid } from "@/lib/utils";

/**
 * Defensive normalisation for anything that crosses a trust boundary:
 * data loaded from disk, JSON backups and Excel imports. Invalid rows are
 * dropped and reported rather than crashing the app.
 */

export function emptyData(): BirthdayBookData {
  return {
    people: [],
    occasions: [],
    reminders: [],
    gifts: [],
    notes: [],
    wishes: [],
    checklist: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

const str = (v: unknown): string => (v == null ? "" : String(v).trim());
const optStr = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s : undefined;
};
const num = (v: unknown): number | undefined => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown, d = false): boolean => {
  if (typeof v === "boolean") return v;
  const s = str(v).toLowerCase();
  if (["true", "yes", "y", "1", "on"].includes(s)) return true;
  if (["false", "no", "n", "0", "off"].includes(s)) return false;
  return d;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => {
  const s = str(v).toLowerCase() as T;
  return list.includes(s) ? s : d;
};
const iso = (v: unknown): string => {
  const s = str(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : nowIso();
};
const list = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  return str(v)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

export function normalizePerson(raw: Record<string, unknown>): Person | undefined {
  const firstName = str(raw.firstName);
  const birthMonth = num(raw.birthMonth);
  const birthDay = num(raw.birthDay);
  if (!firstName || birthMonth == null || birthDay == null) return undefined;
  if (!isValidMonthDay(birthMonth, birthDay)) return undefined;
  const birthYear = num(raw.birthYear);
  return {
    id: str(raw.id) || uid("p"),
    firstName,
    lastName: str(raw.lastName),
    nickname: optStr(raw.nickname),
    relationship: oneOf(raw.relationship, RELATIONSHIPS, "friend"),
    birthMonth,
    birthDay,
    birthYear: birthYear && birthYear > 1850 && birthYear <= 2200 ? Math.trunc(birthYear) : undefined,
    phone: optStr(raw.phone),
    email: optStr(raw.email),
    address: optStr(raw.address),
    tags: list(raw.tags),
    favorite: bool(raw.favorite),
    leapPolicy: raw.leapPolicy === "mar1" || raw.leapPolicy === "feb28" ? raw.leapPolicy : undefined,
    summary: optStr(raw.summary),
    archived: bool(raw.archived),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeOccasion(raw: Record<string, unknown>): Occasion | undefined {
  const title = str(raw.title);
  const month = num(raw.month);
  const day = num(raw.day);
  if (!title || month == null || day == null || !isValidMonthDay(month, day)) return undefined;
  const year = num(raw.year);
  return {
    id: str(raw.id) || uid("o"),
    type: oneOf(raw.type, OCCASION_TYPES, "custom"),
    title,
    personIds: list(raw.personIds),
    month,
    day,
    year: year && year > 1850 && year <= 2200 ? Math.trunc(year) : undefined,
    recurring: bool(raw.recurring, true),
    notes: optStr(raw.notes),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeReminder(raw: Record<string, unknown>): ReminderRule | undefined {
  const targetId = str(raw.targetId);
  if (!targetId) return undefined;
  const offset = num(raw.offsetDays) ?? 0;
  const time = /^\d{1,2}:\d{2}$/.test(str(raw.time)) ? str(raw.time).padStart(5, "0") : "09:00";
  const customDate = /^\d{4}-\d{2}-\d{2}$/.test(str(raw.customDate)) ? str(raw.customDate) : undefined;
  return {
    id: str(raw.id) || uid("r"),
    targetKind: raw.targetKind === "occasion" ? "occasion" : "person",
    targetId,
    offsetDays: Math.max(0, Math.min(365, Math.trunc(offset))),
    time,
    enabled: bool(raw.enabled, true),
    customDate,
    label: optStr(raw.label),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeGift(raw: Record<string, unknown>): Gift | undefined {
  const personId = str(raw.personId);
  const title = str(raw.title);
  if (!personId || !title) return undefined;
  return {
    id: str(raw.id) || uid("g"),
    personId,
    title,
    status: oneOf(raw.status, GIFT_STATUSES, "idea"),
    budget: num(raw.budget),
    price: num(raw.price),
    link: optStr(raw.link),
    year: num(raw.year) ?? new Date().getFullYear(),
    occasionId: optStr(raw.occasionId),
    notes: optStr(raw.notes),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeNote(raw: Record<string, unknown>): Note | undefined {
  const personId = str(raw.personId);
  const text = str(raw.text);
  if (!personId || !text) return undefined;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(raw.date)) ? str(raw.date) : new Date().toISOString().slice(0, 10);
  return {
    id: str(raw.id) || uid("n"),
    personId,
    kind: oneOf(raw.kind, NOTE_KINDS, "general"),
    text,
    date,
    pinned: bool(raw.pinned),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeWish(raw: Record<string, unknown>): Wish | undefined {
  const targetId = str(raw.targetId);
  const year = num(raw.year);
  if (!targetId || year == null) return undefined;
  const status = oneOf(raw.status, ["pending", "sent", "belated", "skipped"] as const, "pending");
  return {
    id: str(raw.id) || uid("w"),
    targetKind: raw.targetKind === "occasion" ? "occasion" : "person",
    targetId,
    year: Math.trunc(year),
    status,
    channel: raw.channel ? oneOf(raw.channel, WISH_CHANNELS, "other") : undefined,
    sentAt: optStr(raw.sentAt),
    message: optStr(raw.message),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizeChecklist(raw: Record<string, unknown>): ChecklistItem | undefined {
  const targetId = str(raw.targetId);
  const text = str(raw.text);
  const year = num(raw.year);
  if (!targetId || !text || year == null) return undefined;
  return {
    id: str(raw.id) || uid("c"),
    targetKind: raw.targetKind === "occasion" ? "occasion" : "person",
    targetId,
    year: Math.trunc(year),
    text,
    done: bool(raw.done),
    order: num(raw.order) ?? 0,
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function normalizePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PREFERENCES;
  const offsets = Array.isArray(r.defaultOffsets)
    ? r.defaultOffsets.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365)
    : list(r.defaultOffsets).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  return {
    theme: oneOf(r.theme, ["light", "dark", "system"] as const, d.theme),
    defaultOffsets: offsets.length ? offsets : d.defaultOffsets,
    defaultTime: /^\d{2}:\d{2}$/.test(str(r.defaultTime)) ? str(r.defaultTime) : d.defaultTime,
    leapPolicy: r.leapPolicy === "mar1" ? "mar1" : "feb28",
    weekStartsOn: Number(r.weekStartsOn) === 0 ? 0 : 1,
    dateOrder: oneOf(String(r.dateOrder ?? "").toUpperCase(), ["DMY", "MDY", "YMD"] as const, d.dateOrder),
    preciseAlarms: bool(r.preciseAlarms, d.preciseAlarms),
    notificationSound: bool(r.notificationSound, d.notificationSound),
    notificationVibrate: bool(r.notificationVibrate, d.notificationVibrate),
    scheduleWindowDays: Math.min(400, Math.max(14, num(r.scheduleWindowDays) ?? d.scheduleWindowDays)),
    belatedWindowDays: Math.min(60, Math.max(1, num(r.belatedWindowDays) ?? d.belatedWindowDays)),
    currency: /^[A-Z]{3}$/.test(str(r.currency).toUpperCase()) ? str(r.currency).toUpperCase() : d.currency,
    lastKnownTimezone: optStr(r.lastKnownTimezone),
    onboarded: bool(r.onboarded, d.onboarded),
  };
}

function normalizeList<T>(
  raw: unknown,
  fn: (r: Record<string, unknown>) => T | undefined,
  errors: string[],
  label: string,
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  raw.forEach((row, i) => {
    const v = row && typeof row === "object" ? fn(row as Record<string, unknown>) : undefined;
    if (v) out.push(v);
    else errors.push(`${label} row ${i + 1} is invalid and was skipped`);
  });
  return out;
}

export function normalizeData(raw: Partial<Record<keyof BirthdayBookData, unknown>>): {
  data: BirthdayBookData;
  errors: string[];
} {
  const errors: string[] = [];
  const data: BirthdayBookData = {
    people: normalizeList(raw.people, normalizePerson, errors, "People"),
    occasions: normalizeList(raw.occasions, normalizeOccasion, errors, "Occasions"),
    reminders: normalizeList(raw.reminders, normalizeReminder, errors, "Reminders"),
    gifts: normalizeList(raw.gifts, normalizeGift, errors, "Gifts"),
    notes: normalizeList(raw.notes, normalizeNote, errors, "Notes"),
    wishes: normalizeList(raw.wishes, normalizeWish, errors, "Wishes"),
    checklist: normalizeList(raw.checklist, normalizeChecklist, errors, "Checklist"),
    preferences: normalizePreferences(raw.preferences),
  };
  // Drop orphaned children so references stay consistent.
  const personIds = new Set(data.people.map((p) => p.id));
  const occasionIds = new Set(data.occasions.map((o) => o.id));
  const targetOk = (k: string, id: string) => (k === "person" ? personIds.has(id) : occasionIds.has(id));
  const before = data.reminders.length + data.gifts.length + data.notes.length + data.wishes.length + data.checklist.length;
  data.reminders = data.reminders.filter((r) => targetOk(r.targetKind, r.targetId));
  data.gifts = data.gifts.filter((g) => personIds.has(g.personId));
  data.notes = data.notes.filter((n) => personIds.has(n.personId));
  data.wishes = data.wishes.filter((w) => targetOk(w.targetKind, w.targetId));
  data.checklist = data.checklist.filter((c) => targetOk(c.targetKind, c.targetId));
  const after = data.reminders.length + data.gifts.length + data.notes.length + data.wishes.length + data.checklist.length;
  if (before !== after) errors.push(`${before - after} linked rows referenced missing people/occasions and were skipped`);
  // De-duplicate ids within each collection (last one wins).
  for (const key of ["people", "occasions", "reminders", "gifts", "notes", "wishes", "checklist"] as const) {
    const seen = new Map<string, unknown>();
    for (const item of data[key] as Array<{ id: string }>) seen.set(item.id, item);
    (data as unknown as Record<string, unknown[]>)[key] = [...seen.values()];
  }
  return { data, errors };
}
