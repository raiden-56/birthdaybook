import type { BirthdayBookData } from "@/types";
import { normalizeData } from "@/services/storage/normalize";

export const BACKUP_FORMAT = "birthdaybook-backup";
export const BACKUP_VERSION = 2;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: { name: string; version: string };
  counts: Record<string, number>;
  data: BirthdayBookData;
}

export function createBackup(data: BirthdayBookData): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: { name: "BirthdayBook", version: "2.0.0" },
    counts: {
      people: data.people.length,
      occasions: data.occasions.length,
      reminders: data.reminders.length,
      gifts: data.gifts.length,
      notes: data.notes.length,
      wishes: data.wishes.length,
      checklist: data.checklist.length,
    },
    data,
  };
}

export function serializeBackup(data: BirthdayBookData): string {
  return JSON.stringify(createBackup(data), null, 2);
}

export interface ParsedBackup {
  data: BirthdayBookData;
  exportedAt?: string;
  errors: string[];
  counts: Record<string, number>;
}

/** Parse and validate a JSON backup. Throws only for unreadable files. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Backup file is empty.");
  const obj = raw as Record<string, unknown>;
  const payload = (obj.format === BACKUP_FORMAT ? obj.data : obj) as Record<string, unknown>;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.people)) {
    throw new Error("This doesn't look like a BirthdayBook backup (no people list found).");
  }
  if (typeof obj.version === "number" && obj.version > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of BirthdayBook. Update the app first.");
  }
  const { data, errors } = normalizeData(payload);
  return {
    data,
    errors,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined,
    counts: {
      people: data.people.length,
      occasions: data.occasions.length,
      reminders: data.reminders.length,
      gifts: data.gifts.length,
      notes: data.notes.length,
    },
  };
}
