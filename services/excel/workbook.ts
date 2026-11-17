import * as XLSX from "xlsx";
import type { BirthdayBookData, Preferences } from "@/types";
import { fullName } from "@/lib/utils";
import { nextOccurrence, ageInYear, ymd } from "@/services/birthday/dates";
import { formatPartsIso } from "./dates";
import {
  CHECKLIST_COLUMNS,
  GIFT_COLUMNS,
  NOTE_COLUMNS,
  OCCASION_COLUMNS,
  PEOPLE_COLUMNS,
  REMINDER_COLUMNS,
  SHEET,
  WISH_COLUMNS,
  type ColumnDef,
} from "./schema";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export interface SheetData {
  name: string;
  headers: string[];
  rows: unknown[][];
  /** 1-based spreadsheet row number of each data row (for error reports). */
  rowNumbers: number[];
}

export interface ReadResult {
  fileName: string;
  sheets: SheetData[];
  isBirthdayBook: boolean;
}

/**
 * Read an .xlsx/.xls/.ods/.csv file. Date-formatted cells are converted to
 * "YYYY-MM-DD" strings from their serial value, so no JS timezone conversion
 * ever touches a birthday.
 */
export function readWorkbook(buffer: ArrayBuffer, fileName: string): ReadResult {
  const isCsv = /\.(csv|tsv|txt)$/i.test(fileName);
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array", cellNF: true, cellDates: false, dense: false });

  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const grid: unknown[][] = [];
    const rowNums: number[] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: unknown[] = [];
      let any = false;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        let v: unknown = "";
        if (cell) {
          if (cell.t === "n" && cell.z && XLSX.SSF.is_date(cell.z as string)) {
            const p = XLSX.SSF.parse_date_code(cell.v as number);
            v = p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : cell.v;
          } else if (cell.t === "d" && cell.v instanceof Date) {
            v = cell.v;
          } else if (cell.t === "b") {
            v = cell.v ? "TRUE" : "FALSE";
          } else if (cell.t !== "z" && cell.t !== "e") {
            v = cell.v ?? "";
          }
        }
        if (v !== "" && v != null) any = true;
        row.push(v);
      }
      if (any) {
        grid.push(row);
        rowNums.push(r + 1);
      }
    }
    if (!grid.length) continue;
    // Header row = first row with at least two non-empty text-ish cells.
    let headerIdx = grid.findIndex((row) => row.filter((v) => String(v ?? "").trim() !== "").length >= 2);
    if (headerIdx < 0) headerIdx = 0;
    const headers = grid[headerIdx].map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
    sheets.push({
      name,
      headers,
      rows: grid.slice(headerIdx + 1),
      rowNumbers: rowNums.slice(headerIdx + 1),
    });
  }
  const people = sheets.find((s) => s.name.toLowerCase() === SHEET.people.toLowerCase());
  const isBirthdayBook = !!people && people.headers.includes("ID") && people.headers.includes("First Name");
  return { fileName, sheets, isBirthdayBook };
}

/** Convert a sheet into objects keyed by column `field` using the schema headers. */
export function sheetToRecords(sheet: SheetData | undefined, columns: ColumnDef[]) {
  if (!sheet) return [] as Array<{ row: number; record: Record<string, unknown> }>;
  const idx = columns
    .filter((c) => !c.computed)
    .map((c) => ({ c, i: sheet.headers.findIndex((h) => h.toLowerCase() === c.header.toLowerCase()) }))
    .filter((x) => x.i >= 0);
  return sheet.rows.map((r, n) => {
    const record: Record<string, unknown> = {};
    for (const { c, i } of idx) record[c.field] = r[i];
    return { row: sheet.rowNumbers[n], record };
  });
}

function sheetFrom(columns: ColumnDef[], rows: Array<Record<string, unknown>>): XLSX.WorkSheet {
  const aoa: unknown[][] = [columns.map((c) => c.header)];
  for (const r of rows) aoa.push(columns.map((c) => r[c.field] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 14 }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length), c: columns.length - 1 } }) };
  // Freeze header row.
  (ws as Record<string, unknown>)["!freeze"] = { xSplit: 0, ySplit: 1 };
  return ws;
}

const yes = (b: boolean | undefined) => (b ? "Yes" : "No");

export function buildWorkbook(data: BirthdayBookData, now = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const nameOf = (kind: string, id: string) =>
    kind === "person"
      ? (() => {
          const p = data.people.find((x) => x.id === id);
          return p ? fullName(p) : "";
        })()
      : data.occasions.find((o) => o.id === id)?.title ?? "";

  const people = data.people.map((p) => {
    const next = nextOccurrence(p.birthMonth, p.birthDay, now, p.leapPolicy ?? data.preferences.leapPolicy);
    return {
      ...p,
      birthday: formatPartsIso({ month: p.birthMonth, day: p.birthDay, year: p.birthYear }),
      tags: p.tags.join(", "),
      favorite: yes(p.favorite),
      archived: yes(p.archived),
      leapPolicy: p.leapPolicy ?? "",
      nextBirthday: ymd(next.date),
      turning: ageInYear(p.birthYear, next.year) ?? "",
    };
  });
  XLSX.utils.book_append_sheet(wb, sheetFrom(PEOPLE_COLUMNS, people), SHEET.people);

  const occasions = data.occasions.map((o) => ({
    ...o,
    date: formatPartsIso({ month: o.month, day: o.day, year: o.year }),
    recurring: yes(o.recurring),
    personIds: o.personIds.join(", "),
    peopleNames: o.personIds.map((id) => nameOf("person", id)).filter(Boolean).join(", "),
  }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(OCCASION_COLUMNS, occasions), SHEET.occasions);

  const reminders = data.reminders.map((r) => ({
    ...r,
    enabled: yes(r.enabled),
    targetName: nameOf(r.targetKind, r.targetId),
    customDate: r.customDate ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(REMINDER_COLUMNS, reminders), SHEET.reminders);

  const gifts = data.gifts.map((g) => ({ ...g, personName: nameOf("person", g.personId) }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(GIFT_COLUMNS, gifts), SHEET.gifts);

  const notes = data.notes.map((n) => ({ ...n, personName: nameOf("person", n.personId), pinned: yes(n.pinned) }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(NOTE_COLUMNS, notes), SHEET.notes);

  const prefRows = Object.entries(data.preferences).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]);
  const prefSheet = XLSX.utils.aoa_to_sheet([["Setting", "Value"], ...prefRows]);
  prefSheet["!cols"] = [{ wch: 22 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, prefSheet, SHEET.preferences);

  const wishes = data.wishes.map((w) => ({ ...w, targetName: nameOf(w.targetKind, w.targetId) }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(WISH_COLUMNS, wishes), SHEET.wishes);

  const checklist = data.checklist.map((c) => ({ ...c, targetName: nameOf(c.targetKind, c.targetId), done: yes(c.done) }));
  XLSX.utils.book_append_sheet(wb, sheetFrom(CHECKLIST_COLUMNS, checklist), SHEET.checklist);

  const readme = XLSX.utils.aoa_to_sheet([
    ["BirthdayBook workbook"],
    [`Exported ${now.toISOString()}`],
    [""],
    ["How to edit"],
    ["• Add people on the People sheet. Leave ID empty for new rows; BirthdayBook assigns one on import."],
    ["• Birthday accepts 1990-03-14, 14/03/1990, 14 March 1990, or --03-14 when the year is unknown."],
    ["• Relationship: family, partner, friend, colleague, client, neighbour, other."],
    ["• Columns 'Next Birthday', 'Turning', 'People', 'Person' and 'For' are calculated and ignored on import."],
    ["• Leap Day Rule (for 29 Feb birthdays): feb28 or mar1. Blank uses the app default."],
    ["• Re-import this file in BirthdayBook → Excel Manager. You'll see a preview before anything changes."],
  ]);
  readme["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, readme, SHEET.readme);
  return wb;
}

export function workbookToBytes(wb: XLSX.WorkBook): Uint8Array {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array", compression: true }) as ArrayBuffer | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function exportXlsx(data: BirthdayBookData): Uint8Array {
  return workbookToBytes(buildWorkbook(data));
}

export function exportPeopleCsv(data: BirthdayBookData): string {
  const ws = buildWorkbook(data).Sheets[SHEET.people];
  return XLSX.utils.sheet_to_csv(ws);
}

export function blankTemplate(): Uint8Array {
  const empty: BirthdayBookData = {
    people: [],
    occasions: [],
    reminders: [],
    gifts: [],
    notes: [],
    wishes: [],
    checklist: [],
    preferences: {} as Preferences,
  };
  const wb = buildWorkbook(empty);
  // Example row to show the expected format.
  XLSX.utils.sheet_add_aoa(
    wb.Sheets[SHEET.people],
    [["", "Asha", "Verma", "", "friend", "1992-03-14", "+91 98765 43210", "asha@example.com", "", "college", "No", "", "Loves sunflowers", "No"]],
    { origin: "A2" },
  );
  wb.Sheets[SHEET.preferences] = XLSX.utils.aoa_to_sheet([["Setting", "Value"]]);
  return workbookToBytes(wb);
}

export function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export function exportFileName(ext: "xlsx" | "csv" | "json" | "ics", prefix = "BirthdayBook"): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `${prefix}_${stamp}.${ext}`;
}
