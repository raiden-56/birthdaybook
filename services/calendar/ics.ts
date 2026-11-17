import type { BirthdayBookData } from "@/types";
import { fullName } from "@/lib/utils";
import { OCCASION_LABEL } from "./events";

/**
 * iCalendar export (RFC 5545) for Google Calendar, Apple Calendar and Outlook.
 * Each person/occasion becomes one all-day yearly recurring event with
 * VALARMs matching the user's enabled reminder offsets. Calendar apps keep
 * these alarms even when BirthdayBook is closed — the most reliable option for
 * browser users.
 */

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string): string {
  // Lines longer than 75 octets must be folded.
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

const d8 = (y: number, m: number, d: number) => `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function alarms(data: BirthdayBookData, kind: "person" | "occasion", id: string, label: string): string[] {
  const rules = data.reminders.filter((r) => r.targetKind === kind && r.targetId === id && r.enabled && !r.customDate);
  const lines: string[] = [];
  for (const r of rules) {
    const [hh, mm] = r.time.split(":").map(Number);
    // All-day events start at 00:00 local; trigger = -offset days + time of day.
    const minutes = -r.offsetDays * 24 * 60 + hh * 60 + mm;
    const sign = minutes < 0 ? "-" : "";
    const abs = Math.abs(minutes);
    const days = Math.floor(abs / 1440);
    const h = Math.floor((abs % 1440) / 60);
    const m = abs % 60;
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(label)}`,
      `TRIGGER;RELATED=START:${sign}P${days ? `${days}D` : ""}T${h}H${m}M`,
      "END:VALARM",
    );
  }
  return lines;
}

export function buildIcs(data: BirthdayBookData): string {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BirthdayBook//BirthdayBook 2.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:BirthdayBook",
    "X-WR-CALDESC:Birthdays and celebrations exported from BirthdayBook",
  ];
  const dtstamp = stamp();

  for (const p of data.people) {
    if (p.archived) continue;
    const name = fullName(p);
    const startYear = p.birthYear ?? now.getFullYear() - 1;
    const isLeap = p.birthMonth === 2 && p.birthDay === 29;
    // A yearly rule on 29 Feb only fires in leap years; use the observed day instead.
    const day = isLeap ? ((p.leapPolicy ?? data.preferences.leapPolicy) === "mar1" ? 1 : 28) : p.birthDay;
    const month = isLeap && day === 1 ? 3 : p.birthMonth;
    const start = d8(startYear, month, day);
    const endDate = new Date(startYear, month - 1, day + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@birthdaybook`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${d8(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate())}`,
      "RRULE:FREQ=YEARLY",
      `SUMMARY:${esc(`${name}'s birthday`)}`,
      `DESCRIPTION:${esc(p.birthYear ? `Born ${p.birthYear}${isLeap ? " (29 February)" : ""}` : "Birthday")}`,
      "CATEGORIES:Birthday",
      "TRANSP:TRANSPARENT",
      ...alarms(data, "person", p.id, `${name}'s birthday`),
      "END:VEVENT",
    );
  }

  for (const o of data.occasions) {
    const y = o.year ?? now.getFullYear();
    const endDate = new Date(y, o.month - 1, o.day + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${o.id}@birthdaybook`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${d8(y, o.month, o.day)}`,
      `DTEND;VALUE=DATE:${d8(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate())}`,
      ...(o.recurring ? ["RRULE:FREQ=YEARLY"] : []),
      `SUMMARY:${esc(o.title)}`,
      `DESCRIPTION:${esc(OCCASION_LABEL[o.type] ?? "Occasion")}${o.notes ? esc(` – ${o.notes}`) : ""}`,
      "TRANSP:TRANSPARENT",
      ...alarms(data, "occasion", o.id, o.title),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
