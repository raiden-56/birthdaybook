import type { BirthdayBookData, Person, Relationship } from "@/types";
import { RELATIONSHIPS } from "@/types";
import {
  normalizeChecklist,
  normalizeGift,
  normalizeNote,
  normalizeOccasion,
  normalizePerson,
  normalizePreferences,
  normalizeReminder,
  normalizeWish,
} from "@/services/storage/normalize";
import { nowIso, uid, fullName } from "@/lib/utils";
import { monthFromValue, parseDateValue } from "./dates";
import {
  CHECKLIST_COLUMNS,
  GIFT_COLUMNS,
  NOTE_COLUMNS,
  OCCASION_COLUMNS,
  PEOPLE_COLUMNS,
  REMINDER_COLUMNS,
  SHEET,
  WISH_COLUMNS,
  type MappableField,
} from "./schema";
import { sheetToRecords, toCsv, type ReadResult, type SheetData } from "./workbook";

export type DuplicateStrategy = "skip" | "update" | "keep-both";

export interface PreviewRow {
  sheet: string;
  row: number;
  person?: Person;
  errors: string[];
  warnings: string[];
  duplicateOfId?: string;
  duplicateOfName?: string;
}

const REL_SYNONYMS: Record<string, Relationship> = {
  mom: "family", mother: "family", mum: "family", dad: "family", father: "family", sister: "family",
  brother: "family", sibling: "family", son: "family", daughter: "family", cousin: "family", aunt: "family",
  uncle: "family", niece: "family", nephew: "family", grandma: "family", grandpa: "family",
  grandmother: "family", grandfather: "family", relative: "family", "in-law": "family",
  wife: "partner", husband: "partner", spouse: "partner", girlfriend: "partner", boyfriend: "partner", fiance: "partner", "fiancé": "partner", fiancee: "partner",
  coworker: "colleague", "co-worker": "colleague", work: "colleague", office: "colleague", boss: "colleague", team: "colleague",
  customer: "client", business: "client",
  neighbor: "neighbour", neighbours: "neighbour", neighbors: "neighbour",
  friends: "friend", bestie: "friend", "best friend": "friend", school: "friend", college: "friend",
};

export function mapRelationship(v: unknown): Relationship {
  const s = String(v ?? "").trim().toLowerCase();
  if ((RELATIONSHIPS as string[]).includes(s)) return s as Relationship;
  if (REL_SYNONYMS[s]) return REL_SYNONYMS[s];
  for (const [k, r] of Object.entries(REL_SYNONYMS)) if (s.includes(k)) return r;
  return s ? "other" : "friend";
}

export function duplicateKey(p: Pick<Person, "firstName" | "lastName" | "birthMonth" | "birthDay">): string {
  return `${p.firstName.trim().toLowerCase()}|${(p.lastName ?? "").trim().toLowerCase()}|${p.birthMonth}-${p.birthDay}`;
}

/**
 * Analyse rows of an arbitrary spreadsheet using a user-confirmed column
 * mapping. Nothing is written; the result drives the preview screen.
 */
export function analyzePeopleSheet(
  sheet: SheetData,
  mapping: MappableField[],
  existing: Person[],
  dateOrder: "DMY" | "MDY" | "YMD",
): PreviewRow[] {
  const col = (f: MappableField) => mapping.indexOf(f);
  const existingByKey = new Map(existing.map((p) => [duplicateKey(p), p]));
  const existingById = new Map(existing.map((p) => [p.id, p]));
  const seenInFile = new Map<string, number>();

  return sheet.rows.map((r, i) => {
    const rowNo = sheet.rowNumbers[i];
    const get = (f: MappableField) => (col(f) >= 0 ? r[col(f)] : undefined);
    const errors: string[] = [];
    const warnings: string[] = [];

    let first = String(get("firstName") ?? "").trim();
    let last = String(get("lastName") ?? "").trim();
    const full = String(get("fullName") ?? "").trim();
    if (!first && full) {
      const parts = full.split(/\s+/);
      first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      last = last || (parts.length > 1 ? parts[parts.length - 1] : "");
    }
    if (!first) errors.push("Missing name");

    let month: number | undefined;
    let day: number | undefined;
    let year: number | undefined;
    const bdayRaw = get("birthday");
    if (bdayRaw != null && bdayRaw !== "") {
      const parsed = parseDateValue(bdayRaw, dateOrder);
      if (parsed) {
        month = parsed.month;
        day = parsed.day;
        year = parsed.year;
        if (parsed.year && parsed.year <= 1900) {
          // Some apps store unknown years as 1900/1904/0000.
          year = undefined;
          warnings.push("Year looked like a placeholder and was ignored");
        }
      } else {
        errors.push(`Unrecognised birthday "${String(bdayRaw)}"`);
      }
    } else {
      const d = Number(get("birthDay"));
      const m = monthFromValue(get("birthMonth"));
      if (Number.isInteger(d) && d > 0 && m) {
        day = d;
        month = m;
      } else if (get("birthDay") != null || get("birthMonth") != null) {
        errors.push("Birth day/month could not be read");
      } else {
        errors.push("Missing birthday");
      }
    }
    const yRaw = get("birthYear");
    if (yRaw != null && yRaw !== "" && year == null) {
      const y = Number(yRaw);
      if (Number.isInteger(y) && y > 1900 && y <= new Date().getFullYear()) year = y;
      else warnings.push(`Birth year "${String(yRaw)}" ignored`);
    }
    if (year && year > new Date().getFullYear()) {
      warnings.push("Birth year is in the future and was ignored");
      year = undefined;
    }
    if (month === 2 && day === 29 && year && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) {
      errors.push(`29 February ${year} is not a real date`);
    }

    const email = String(get("email") ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push("Email looks invalid");

    if (errors.length) return { sheet: sheet.name, row: rowNo, errors, warnings };

    const ts = nowIso();
    const candidate = normalizePerson({
      id: String(get("id") ?? "").trim() || uid("p"),
      firstName: first,
      lastName: last,
      nickname: get("nickname"),
      relationship: mapRelationship(get("relationship")),
      birthMonth: month,
      birthDay: day,
      birthYear: year,
      phone: get("phone"),
      email,
      address: get("address"),
      tags: get("tags"),
      favorite: get("favorite"),
      summary: get("summary"),
      createdAt: ts,
      updatedAt: ts,
    });
    if (!candidate) return { sheet: sheet.name, row: rowNo, errors: ["Row could not be converted"], warnings };

    const key = duplicateKey(candidate);
    const dupe = existingById.get(candidate.id) ?? existingByKey.get(key);
    const preview: PreviewRow = { sheet: sheet.name, row: rowNo, person: candidate, errors, warnings };
    if (dupe) {
      preview.duplicateOfId = dupe.id;
      preview.duplicateOfName = fullName(dupe);
    } else if (seenInFile.has(key)) {
      warnings.push(`Same person and birthday as row ${seenInFile.get(key)}`);
    }
    seenInFile.set(key, rowNo);
    return preview;
  });
}

/** Apply the preview to the current data according to the duplicate strategy. */
export function applyPeoplePreview(
  rows: PreviewRow[],
  existing: Person[],
  strategy: DuplicateStrategy,
): { add: Person[]; update: Person[]; skipped: number } {
  const add: Person[] = [];
  const update: Person[] = [];
  let skipped = 0;
  const byId = new Map(existing.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.person || r.errors.length) {
      skipped++;
      continue;
    }
    const key = duplicateKey(r.person);
    if (r.duplicateOfId) {
      if (strategy === "skip") {
        skipped++;
        continue;
      }
      if (strategy === "update") {
        const old = byId.get(r.duplicateOfId)!;
        update.push({
          ...old,
          ...Object.fromEntries(Object.entries(r.person).filter(([k, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && k !== "id" && k !== "createdAt")),
          id: old.id,
          createdAt: old.createdAt,
          updatedAt: nowIso(),
        } as Person);
        continue;
      }
      add.push({ ...r.person, id: uid("p") });
      continue;
    }
    if (seen.has(key) && strategy !== "keep-both") {
      skipped++;
      continue;
    }
    seen.add(key);
    add.push(r.person);
  }
  return { add, update, skipped };
}

/** Full BirthdayBook workbook → data set (all sheets). Returns per-row errors. */
export function parseBirthdayBookWorkbook(wb: ReadResult, dateOrder: "DMY" | "MDY" | "YMD") {
  const sheet = (n: string) => wb.sheets.find((s) => s.name.toLowerCase() === n.toLowerCase());
  const errors: Array<{ sheet: string; row: number; message: string }> = [];
  const yesNo = (v: unknown) => /^(yes|y|true|1)$/i.test(String(v ?? "").trim());

  const people: BirthdayBookData["people"] = [];
  for (const { row, record } of sheetToRecords(sheet(SHEET.people), PEOPLE_COLUMNS)) {
    const parsed = parseDateValue(record.birthday, dateOrder);
    if (!String(record.firstName ?? "").trim()) {
      if (Object.values(record).some((v) => String(v ?? "").trim())) errors.push({ sheet: SHEET.people, row, message: "Missing first name" });
      continue;
    }
    if (!parsed) {
      errors.push({ sheet: SHEET.people, row, message: `Unrecognised birthday "${String(record.birthday ?? "")}"` });
      continue;
    }
    const p = normalizePerson({
      ...record,
      relationship: mapRelationship(record.relationship),
      birthMonth: parsed.month,
      birthDay: parsed.day,
      birthYear: parsed.year,
      favorite: yesNo(record.favorite),
      archived: yesNo(record.archived),
    });
    if (p) people.push(p);
    else errors.push({ sheet: SHEET.people, row, message: "Invalid row" });
  }

  const collect = <T>(name: string, cols: typeof PEOPLE_COLUMNS, fn: (r: Record<string, unknown>) => T | undefined, pre?: (r: Record<string, unknown>) => Record<string, unknown>) => {
    const out: T[] = [];
    for (const { row, record } of sheetToRecords(sheet(name), cols)) {
      if (!Object.values(record).some((v) => String(v ?? "").trim())) continue;
      const v = fn(pre ? pre(record) : record);
      if (v) out.push(v);
      else errors.push({ sheet: name, row, message: "Invalid or incomplete row" });
    }
    return out;
  };

  const occasions = collect(SHEET.occasions, OCCASION_COLUMNS, normalizeOccasion, (r) => {
    const d = parseDateValue(r.date, dateOrder);
    return { ...r, month: d?.month, day: d?.day, year: d?.year, recurring: r.recurring === "" ? true : yesNo(r.recurring) };
  });
  const reminders = collect(SHEET.reminders, REMINDER_COLUMNS, normalizeReminder, (r) => ({
    ...r,
    enabled: r.enabled === "" ? true : yesNo(r.enabled),
    targetKind: String(r.targetKind ?? "").toLowerCase(),
  }));
  const gifts = collect(SHEET.gifts, GIFT_COLUMNS, normalizeGift);
  const notes = collect(SHEET.notes, NOTE_COLUMNS, normalizeNote, (r) => ({ ...r, pinned: yesNo(r.pinned) }));
  const wishes = collect(SHEET.wishes, WISH_COLUMNS, normalizeWish);
  const checklist = collect(SHEET.checklist, CHECKLIST_COLUMNS, normalizeChecklist, (r) => ({ ...r, done: yesNo(r.done) }));

  let preferences: BirthdayBookData["preferences"] | undefined;
  const prefSheet = sheet(SHEET.preferences);
  if (prefSheet && prefSheet.rows.length) {
    const obj: Record<string, unknown> = {};
    for (const r of prefSheet.rows) if (r[0]) obj[String(r[0])] = r[1];
    preferences = normalizePreferences(obj);
  }

  return {
    data: { people, occasions, reminders, gifts, notes, wishes, checklist, preferences } as Partial<BirthdayBookData>,
    errors,
  };
}

export function errorReportCsv(rows: Array<{ sheet: string; row: number; message: string }>): string {
  return toCsv([["Sheet", "Row", "Problem"], ...rows.map((r) => [r.sheet, r.row, r.message])]);
}

export function previewErrorsCsv(rows: PreviewRow[]): string {
  const out: unknown[][] = [["Sheet", "Row", "Severity", "Problem"]];
  for (const r of rows) {
    for (const e of r.errors) out.push([r.sheet, r.row, "error", e]);
    for (const w of r.warnings) out.push([r.sheet, r.row, "warning", w]);
    if (r.duplicateOfName) out.push([r.sheet, r.row, "duplicate", `Matches existing ${r.duplicateOfName}`]);
  }
  return toCsv(out);
}
