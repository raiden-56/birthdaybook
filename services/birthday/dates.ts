import { addDays, differenceInCalendarDays, isLeapYear, startOfDay } from "date-fns";
import type { LeapPolicy } from "@/types";

/**
 * All celebration dates are evaluated as *local calendar dates*. We never
 * convert a birthday to UTC; a birthday on 14 March is 14 March in whatever
 * timezone the device is currently in.
 */

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= max;
}

export function isValidDate(year: number | undefined, month: number, day: number): boolean {
  if (!isValidMonthDay(month, day)) return false;
  if (year == null) return true;
  if (month === 2 && day === 29) return isLeapYear(new Date(year, 0, 1));
  return true;
}

/**
 * The date on which a recurring month/day is observed in a given year.
 * 29 Feb falls back to 28 Feb or 1 Mar in non-leap years per `leapPolicy`.
 */
export function observedDate(
  month: number,
  day: number,
  year: number,
  leapPolicy: LeapPolicy = "feb28",
): { date: Date; shifted: boolean } {
  if (month === 2 && day === 29 && !isLeapYear(new Date(year, 0, 1))) {
    return leapPolicy === "mar1"
      ? { date: new Date(year, 2, 1), shifted: true }
      : { date: new Date(year, 1, 28), shifted: true };
  }
  return { date: new Date(year, month - 1, day), shifted: false };
}

/** Next observed occurrence on or after `from` (compared by calendar day). */
export function nextOccurrence(
  month: number,
  day: number,
  from: Date,
  leapPolicy: LeapPolicy = "feb28",
): { date: Date; year: number; shifted: boolean } {
  const today = startOfDay(from);
  for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) {
    const o = observedDate(month, day, y, leapPolicy);
    if (o.date >= today) return { ...o, year: y };
  }
  // Unreachable for valid input, but keep a safe fallback.
  const y = today.getFullYear() + 1;
  return { ...observedDate(month, day, y, leapPolicy), year: y };
}

/** Most recent observed occurrence strictly before `from`. */
export function previousOccurrence(
  month: number,
  day: number,
  from: Date,
  leapPolicy: LeapPolicy = "feb28",
): { date: Date; year: number; shifted: boolean } {
  const today = startOfDay(from);
  for (let y = today.getFullYear(); y >= today.getFullYear() - 1; y--) {
    const o = observedDate(month, day, y, leapPolicy);
    if (o.date < today) return { ...o, year: y };
  }
  const y = today.getFullYear() - 1;
  return { ...observedDate(month, day, y, leapPolicy), year: y };
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  return differenceInCalendarDays(startOfDay(date), startOfDay(from));
}

/** Age reached on the celebration in `year`. Undefined when the birth year is unknown. */
export function ageInYear(birthYear: number | undefined, year: number): number | undefined {
  if (birthYear == null) return undefined;
  const age = year - birthYear;
  return age >= 0 ? age : undefined;
}

/** Current age in completed years on `on`. */
export function currentAge(
  birthYear: number | undefined,
  month: number,
  day: number,
  on: Date = new Date(),
  leapPolicy: LeapPolicy = "feb28",
): number | undefined {
  if (birthYear == null) return undefined;
  const thisYear = observedDate(month, day, on.getFullYear(), leapPolicy).date;
  const age = on.getFullYear() - birthYear - (startOfDay(on) < thisYear ? 1 : 0);
  return age >= 0 ? age : undefined;
}

const BIRTHDAY_MILESTONES = new Set([1, 13, 16, 18, 21, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100]);
const ANNIVERSARY_MILESTONES = new Set([1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75]);

export function isBirthdayMilestone(age: number | undefined): boolean {
  if (age == null) return false;
  return BIRTHDAY_MILESTONES.has(age) || (age > 100 && age % 5 === 0);
}

export function isAnniversaryMilestone(years: number | undefined): boolean {
  if (years == null) return false;
  return ANNIVERSARY_MILESTONES.has(years);
}

export function anniversaryName(years: number): string | undefined {
  const names: Record<number, string> = {
    1: "Paper",
    5: "Wood",
    10: "Tin",
    15: "Crystal",
    20: "China",
    25: "Silver",
    30: "Pearl",
    40: "Ruby",
    50: "Golden",
    60: "Diamond",
    75: "Platinum",
  };
  return names[years];
}

export function zodiacSign(month: number, day: number): string {
  const signs: Array<[number, number, string]> = [
    [1, 20, "Capricorn"],
    [2, 19, "Aquarius"],
    [3, 20, "Pisces"],
    [4, 20, "Aries"],
    [5, 21, "Taurus"],
    [6, 21, "Gemini"],
    [7, 22, "Cancer"],
    [8, 23, "Leo"],
    [9, 23, "Virgo"],
    [10, 23, "Libra"],
    [11, 22, "Scorpio"],
    [12, 22, "Sagittarius"],
  ];
  const [, cutoff, sign] = signs[month - 1];
  if (day < cutoff) return sign;
  return month === 12 ? "Capricorn" : signs[month][2];
}

/** Local Date at the given wall-clock time ("HH:mm") on the given calendar day. */
export function atLocalTime(day: Date, time: string): Date {
  const [h, m] = parseTime(time);
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  return d;
}

export function parseTime(time: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  if (!match) return [9, 0];
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return [h, m];
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYmd(s: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export { addDays, startOfDay };
