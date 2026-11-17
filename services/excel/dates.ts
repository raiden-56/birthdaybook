import { isValidDate } from "@/services/birthday/dates";

export interface ParsedDate {
  month: number;
  day: number;
  year?: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function fixYear(y: number): number {
  if (y >= 100) return y;
  const nowYY = new Date().getFullYear() % 100;
  return y > nowYY ? 1900 + y : 2000 + y;
}

/**
 * Convert an Excel serial date (1900 date system) to calendar parts without
 * touching JS timezones. Serial 60 is Excel's fictitious 29 Feb 1900.
 */
export function excelSerialToParts(serial: number): ParsedDate | undefined {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return undefined;
  const whole = Math.floor(serial);
  if (whole === 60) return { year: 1900, month: 2, day: 29 };
  const days = whole > 60 ? whole - 1 : whole; // skip the fake leap day
  const ms = Date.UTC(1899, 11, 31) + days * 86400000;
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function valid(p: ParsedDate | undefined): ParsedDate | undefined {
  if (!p) return undefined;
  return isValidDate(p.year, p.month, p.day) ? p : undefined;
}

/**
 * Parse a birthday-like cell. Accepts ISO dates, "--MM-DD" (no year),
 * day/month/year in the configured order, month names, Excel serial numbers
 * and JS Date objects (read in UTC to avoid timezone drift).
 */
export function parseDateValue(value: unknown, order: "DMY" | "MDY" | "YMD" = "DMY"): ParsedDate | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return valid({ year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() });
  }
  if (typeof value === "number") return valid(excelSerialToParts(value));

  const s = String(value).trim().replace(/\s+/g, " ");
  if (!s) return undefined;

  let m: RegExpExecArray | null;
  // --MM-DD or --MMDD (ISO 8601 without year)
  if ((m = /^--(\d{2})-?(\d{2})$/.exec(s))) return valid({ month: +m[1], day: +m[2] });
  // YYYY-MM-DD, YYYY/MM/DD, with optional time
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s)))
    return valid({ year: +m[1], month: +m[2], day: +m[3] });
  // 0000-MM-DD is sometimes used for unknown year
  // a/b/c
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) {
    const a = +m[1];
    const b = +m[2];
    const y = fixYear(+m[3]);
    let day = order === "MDY" ? b : a;
    let month = order === "MDY" ? a : b;
    if (month > 12 && day <= 12) [day, month] = [month, day]; // unambiguous swap
    return valid({ year: y, month, day });
  }
  // a/b (no year)
  if ((m = /^(\d{1,2})[-/.](\d{1,2})$/.exec(s))) {
    const a = +m[1];
    const b = +m[2];
    let day = order === "MDY" ? b : a;
    let month = order === "MDY" ? a : b;
    if (month > 12 && day <= 12) [day, month] = [month, day];
    return valid({ month, day });
  }
  // "14 March 1990", "14th Mar", "14-Mar-90"
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([a-z]+)\.?(?:[\s\-/.,]+(\d{2,4}))?$/i.exec(s))) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return valid({ day: +m[1], month, year: m[3] ? fixYear(+m[3]) : undefined });
  }
  // "March 14, 1990", "Mar 14"
  if ((m = /^([a-z]+)\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?(?:[\s,\-/.]+(\d{2,4}))?$/i.exec(s))) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return valid({ day: +m[2], month, year: m[3] ? fixYear(+m[3]) : undefined });
  }
  // Bare serial number stored as text
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return valid(excelSerialToParts(Number(s)));
  return undefined;
}

export function formatPartsIso(p: ParsedDate): string {
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return p.year ? `${p.year}-${mm}-${dd}` : `--${mm}-${dd}`;
}

export function monthFromValue(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return MONTHS[String(v).trim().toLowerCase().replace(/\.$/, "")];
}
