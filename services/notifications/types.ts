import type { PlannedNotification } from "@/types";
import type { PlatformName } from "@/platform";

export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface PendingInfo {
  id: number;
  at?: Date;
  title?: string;
  extra?: NotificationExtra;
}

export interface NotificationExtra {
  bb: 1;
  kind: "reminder" | "snooze" | "test";
  key: string;
  targetKind?: "person" | "occasion";
  targetId?: string;
  eventYear?: number;
  at?: string;
}

export interface ScheduleSettings {
  precise: boolean;
  sound: boolean;
  vibrate: boolean;
}

export type NotificationActionId = "snooze-1h" | "snooze-tomorrow" | "mark-wished" | "tap";

export interface NotificationHandlers {
  onAction(action: NotificationActionId, extra: NotificationExtra | undefined, title?: string, body?: string): void;
}

/**
 * Platform notification contract. Android/iOS use Capacitor Local
 * Notifications (OS-held alarms that fire while the app is closed). The web
 * adapter can only fire while a BirthdayBook tab or installed PWA is running.
 */
export interface NotificationAdapter {
  readonly platform: PlatformName;
  readonly kind: "native" | "web";
  /** Max pending notifications this platform will hold for us. */
  readonly maxPending: number;
  /** Slots kept free for snoozes/tests. */
  readonly reserve: number;
  init(handlers: NotificationHandlers): Promise<void>;
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  /** Android 12+: whether exact alarms are allowed. */
  exactAlarmStatus(): Promise<"granted" | "denied" | "not-applicable">;
  openExactAlarmSettings(): Promise<void>;
  /** Only BirthdayBook-owned pending notifications. */
  getPending(): Promise<PendingInfo[]>;
  schedule(list: PlannedNotification[], settings: ScheduleSettings): Promise<{ warning?: string }>;
  cancel(ids: number[]): Promise<void>;
  snooze(extra: NotificationExtra, title: string, body: string, at: Date, settings: ScheduleSettings): Promise<void>;
  sendTest(settings: ScheduleSettings, inSeconds: number): Promise<void>;
}

export function toExtra(n: PlannedNotification): NotificationExtra {
  return {
    bb: 1,
    kind: "reminder",
    key: n.key,
    targetKind: n.targetKind,
    targetId: n.targetId,
    eventYear: n.eventYear,
    at: n.at.toISOString(),
  };
}

export function isOurs(extra: unknown): extra is NotificationExtra {
  return !!extra && typeof extra === "object" && (extra as { bb?: unknown }).bb === 1;
}
