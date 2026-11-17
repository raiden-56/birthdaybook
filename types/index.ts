/**
 * BirthdayBook domain model.
 *
 * Dates without a time component are stored as plain numbers (month 1-12,
 * day 1-31, optional year) so they never drift across timezones. Only
 * notification fire times are absolute instants, and those are recomputed
 * from local wall-clock time whenever the device timezone changes.
 */

export type ID = string;

export type Relationship =
  | "family"
  | "partner"
  | "friend"
  | "colleague"
  | "client"
  | "neighbour"
  | "other";

export const RELATIONSHIPS: Relationship[] = [
  "family",
  "partner",
  "friend",
  "colleague",
  "client",
  "neighbour",
  "other",
];

/** How a 29 February date is observed in non-leap years. */
export type LeapPolicy = "feb28" | "mar1";

export interface Person {
  id: ID;
  firstName: string;
  lastName: string;
  nickname?: string;
  relationship: Relationship;
  birthMonth: number; // 1-12
  birthDay: number; // 1-31
  birthYear?: number; // optional – unknown year is allowed
  phone?: string;
  email?: string;
  address?: string;
  tags: string[];
  favorite: boolean;
  /** Overrides the global leap policy for this person. */
  leapPolicy?: LeapPolicy;
  /** Free-form notes kept on the person row (relationship memory lives in Notes). */
  summary?: string;
  archived?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type OccasionType =
  | "anniversary"
  | "wedding"
  | "work-anniversary"
  | "memorial"
  | "graduation"
  | "custom";

export const OCCASION_TYPES: OccasionType[] = [
  "anniversary",
  "wedding",
  "work-anniversary",
  "memorial",
  "graduation",
  "custom",
];

export interface Occasion {
  id: ID;
  type: OccasionType;
  title: string;
  /** People involved (e.g. both partners of an anniversary). */
  personIds: ID[];
  month: number;
  day: number;
  year?: number;
  recurring: boolean; // false = one-off event in `year`
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Target of a reminder or of a derived calendar event. */
export type TargetKind = "person" | "occasion";

export interface ReminderRule {
  id: ID;
  targetKind: TargetKind;
  targetId: ID;
  /** Days before the celebration. 0 = on the day. Ignored when `customDate` is set. */
  offsetDays: number;
  /** Local wall-clock time, "HH:mm". */
  time: string;
  enabled: boolean;
  /** One-off custom date (YYYY-MM-DD). When set the rule fires once at that date. */
  customDate?: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export type GiftStatus = "idea" | "planned" | "purchased" | "wrapped" | "given";
export const GIFT_STATUSES: GiftStatus[] = ["idea", "planned", "purchased", "wrapped", "given"];

export interface Gift {
  id: ID;
  personId: ID;
  title: string;
  status: GiftStatus;
  budget?: number;
  price?: number;
  link?: string;
  /** Celebration year the gift is for. */
  year: number;
  occasionId?: ID;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type NoteKind = "memory" | "preference" | "conversation" | "idea" | "general";
export const NOTE_KINDS: NoteKind[] = ["memory", "preference", "conversation", "idea", "general"];

export interface Note {
  id: ID;
  personId: ID;
  kind: NoteKind;
  text: string;
  date: string; // YYYY-MM-DD
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WishStatus = "pending" | "sent" | "belated" | "skipped";
export type WishChannel = "call" | "message" | "card" | "in-person" | "social" | "email" | "other";
export const WISH_CHANNELS: WishChannel[] = ["call", "message", "card", "in-person", "social", "email", "other"];

export interface Wish {
  id: ID;
  targetKind: TargetKind;
  targetId: ID;
  year: number;
  status: WishStatus;
  channel?: WishChannel;
  sentAt?: string; // ISO
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: ID;
  targetKind: TargetKind;
  targetId: ID;
  year: number;
  text: string;
  done: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type ThemeMode = "light" | "dark" | "system";

export interface Preferences {
  theme: ThemeMode;
  /** Default reminder offsets applied to new people, in days before. */
  defaultOffsets: number[];
  defaultTime: string; // HH:mm
  leapPolicy: LeapPolicy;
  /** Week starts on: 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  /** Date format hint used for ambiguous imports. */
  dateOrder: "DMY" | "MDY" | "YMD";
  /** User opted into Android exact alarms (precise timing). */
  preciseAlarms: boolean;
  notificationSound: boolean;
  notificationVibrate: boolean;
  /** Days ahead the scheduler keeps booked with the OS. */
  scheduleWindowDays: number;
  belatedWindowDays: number;
  currency: string;
  lastKnownTimezone?: string;
  onboarded: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  defaultOffsets: [7, 3, 1, 0],
  defaultTime: "09:00",
  leapPolicy: "feb28",
  weekStartsOn: 1,
  dateOrder: "DMY",
  preciseAlarms: false,
  notificationSound: true,
  notificationVibrate: true,
  scheduleWindowDays: 120,
  belatedWindowDays: 14,
  currency: "INR",
  onboarded: false,
};

/** The full, portable data set. One-to-one with the Excel workbook and JSON backup. */
export interface BirthdayBookData {
  people: Person[];
  occasions: Occasion[];
  reminders: ReminderRule[];
  gifts: Gift[];
  notes: Note[];
  wishes: Wish[];
  checklist: ChecklistItem[];
  preferences: Preferences;
}

export type CollectionName = Exclude<keyof BirthdayBookData, "preferences">;

export const COLLECTIONS: CollectionName[] = [
  "people",
  "occasions",
  "reminders",
  "gifts",
  "notes",
  "wishes",
  "checklist",
];

/** A concrete celebration on a concrete date, derived from a Person or Occasion. */
export interface CelebrationEvent {
  key: string; // `${kind}:${id}:${year}`
  kind: TargetKind;
  targetId: ID;
  title: string;
  subtitle: string;
  type: "birthday" | OccasionType;
  date: Date; // local midnight of the observed date
  year: number;
  /** Age turning (birthdays) or years together (occasions), when the start year is known. */
  turning?: number;
  isMilestone: boolean;
  personIds: ID[];
  /** True when a 29 Feb date is being observed on 28 Feb / 1 Mar. */
  shiftedFromLeapDay: boolean;
}

/** A notification the scheduler intends the OS to hold. */
export interface PlannedNotification {
  id: number; // stable 31-bit int (Android requirement)
  key: string; // human-readable stable key used to derive the id
  title: string;
  body: string;
  at: Date;
  targetKind: TargetKind;
  targetId: ID;
  ruleId: ID;
  eventYear: number;
  offsetDays: number;
  channel: "reminders" | "celebration-day";
}

export interface ScheduledRecord {
  id: number;
  key: string;
  at: string; // ISO
  title: string;
  targetId: ID;
  confirmed: boolean;
}

export type ReminderHealth =
  | "enabled"
  | "disabled"
  | "permission-required"
  | "needs-refresh"
  | "unsupported";

export interface SchedulerState {
  lastReconciledAt?: string;
  lastTimezone?: string;
  lastDataHash?: string;
  platform?: string;
  scheduled: ScheduledRecord[];
  lastError?: string;
  lastWarning?: string;
}
