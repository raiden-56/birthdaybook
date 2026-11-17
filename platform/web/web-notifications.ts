import type { PlannedNotification } from "@/types";
import {
  toExtra,
  type NotificationActionId,
  type NotificationAdapter,
  type NotificationExtra,
  type NotificationHandlers,
  type PendingInfo,
  type PermissionState,
  type ScheduleSettings,
} from "@/services/notifications/types";
import { PLATFORM_LIMITS } from "@/services/reminders/planner";
import { stableNotificationId } from "@/lib/utils";
import { withBase } from "@/lib/basePath";

const PLAN_KEY = "bb.web.plan";
const FIRED_KEY = "bb.web.fired";
/** Reminders missed while the browser was closed are still shown if they are this recent. */
const GRACE_MS = 12 * 60 * 60 * 1000;
const TICK_MS = 30_000;

interface StoredItem {
  id: number;
  title: string;
  body: string;
  at: string;
  extra: NotificationExtra;
}

function readPlan(): StoredItem[] {
  try {
    return JSON.parse(localStorage.getItem(PLAN_KEY) ?? "[]") as StoredItem[];
  } catch {
    return [];
  }
}
function writePlan(items: StoredItem[]) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}
function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function writeFired(f: Record<string, number>) {
  // Keep the fired log small.
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 400;
  const trimmed = Object.fromEntries(Object.entries(f).filter(([, t]) => t > cutoff));
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/**
 * Browser notifications. Browsers have no API for OS-held future alarms, so
 * the schedule is kept locally and checked every 30 seconds (and whenever the
 * tab becomes visible) while a BirthdayBook tab or installed PWA is running.
 * For reminders that must fire with the browser closed, export the calendar
 * (.ics) into Google/Apple Calendar, or install the Android/iOS app.
 */
export class WebNotificationAdapter implements NotificationAdapter {
  readonly platform = "web" as const;
  readonly kind = "web" as const;
  readonly maxPending = PLATFORM_LIMITS.web;
  readonly reserve = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private handlers: NotificationHandlers | null = null;

  async init(handlers: NotificationHandlers) {
    this.handlers = handlers;
    if (typeof window === "undefined") return;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.tick();
    });
    navigator.serviceWorker?.addEventListener("message", (ev: MessageEvent) => {
      const msg = ev.data as { type?: string; action?: NotificationActionId; extra?: NotificationExtra; title?: string; body?: string };
      if (msg?.type === "bb-notification-action" && msg.action) {
        this.handlers?.onAction(msg.action, msg.extra, msg.title, msg.body);
      }
    });
    void this.tick();
  }

  async permission(): Promise<PermissionState> {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return "prompt";
  }

  async requestPermission(): Promise<PermissionState> {
    if (typeof Notification === "undefined") return "unsupported";
    const res = await Notification.requestPermission();
    return res === "granted" ? "granted" : res === "denied" ? "denied" : "prompt";
  }

  async exactAlarmStatus() {
    return "not-applicable" as const;
  }
  async openExactAlarmSettings() {}

  async getPending(): Promise<PendingInfo[]> {
    const now = Date.now();
    return readPlan()
      .filter((i) => new Date(i.at).getTime() > now)
      .map((i) => ({ id: i.id, at: new Date(i.at), title: i.title, extra: i.extra }));
  }

  async schedule(list: PlannedNotification[]) {
    const plan = readPlan();
    const map = new Map(plan.map((p) => [p.id, p]));
    for (const n of list) {
      map.set(n.id, { id: n.id, title: n.title, body: n.body, at: n.at.toISOString(), extra: toExtra(n) });
    }
    writePlan([...map.values()]);
    return {};
  }

  async cancel(ids: number[]) {
    const drop = new Set(ids);
    writePlan(readPlan().filter((p) => !drop.has(p.id)));
  }

  async snooze(extra: NotificationExtra, title: string, body: string, at: Date) {
    const id = stableNotificationId(`snooze:${extra.key}`);
    const plan = readPlan().filter((p) => p.id !== id);
    plan.push({ id, title, body, at: at.toISOString(), extra: { ...extra, kind: "snooze", at: at.toISOString() } });
    writePlan(plan);
  }

  async sendTest(_s: ScheduleSettings, inSeconds: number) {
    const at = new Date(Date.now() + inSeconds * 1000);
    const id = stableNotificationId("test:birthdaybook");
    const plan = readPlan().filter((p) => p.id !== id);
    plan.push({
      id,
      title: "BirthdayBook test reminder",
      body: "Browser notifications are working. Keep a BirthdayBook tab open for reminders to fire.",
      at: at.toISOString(),
      extra: { bb: 1, kind: "test", key: "test", at: at.toISOString() },
    });
    writePlan(plan);
    setTimeout(() => void this.tick(), inSeconds * 1000 + 250);
  }

  /** Fire due notifications. */
  private async tick() {
    if ((await this.permission()) !== "granted") return;
    const now = Date.now();
    const fired = readFired();
    const plan = readPlan();
    let changed = false;
    for (const item of plan) {
      const t = new Date(item.at).getTime();
      const fireKey = `${item.id}@${item.at}`;
      if (t > now || fired[fireKey]) continue;
      fired[fireKey] = now;
      changed = true;
      if (now - t > GRACE_MS) continue; // too old – skip silently
      await this.show(item);
    }
    if (changed) {
      writeFired(fired);
      // Drop fired snoozes/tests; reminder entries are pruned by the next reconcile.
      writePlan(plan.filter((p) => !(p.extra.kind !== "reminder" && new Date(p.at).getTime() <= now)));
    }
  }

  private async show(item: StoredItem) {
    const options: NotificationOptions & { actions?: Array<{ action: string; title: string }> } = {
      body: item.body,
      tag: `bb-${item.id}`,
      icon: withBase("/icons/icon-192.png"),
      badge: withBase("/icons/badge-96.png"),
      data: { extra: item.extra, title: item.title, body: item.body },
      actions: [
        { action: "mark-wished", title: "Mark as wished" },
        { action: "snooze-1h", title: "Snooze 1 hour" },
      ],
    };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(item.title, options);
        return;
      }
    } catch {
      /* fall through */
    }
    const n = new Notification(item.title, { body: item.body, tag: options.tag, icon: options.icon });
    n.onclick = () => {
      window.focus();
      this.handlers?.onAction("tap", item.extra, item.title, item.body);
    };
  }
}
