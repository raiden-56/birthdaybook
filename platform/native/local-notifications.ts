import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type { PlannedNotification } from "@/types";
import type { PlatformName } from "@/platform";
import {
  isOurs,
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
import { checkExactAlarm, ensureAllChannels, ensureChannel, openExactAlarmSettings } from "@/platform/android/channels";
import { IOS_CATEGORY, IOS_PENDING_LIMIT, IOS_RESERVED_SLOTS } from "@/platform/ios/notifications";

const BATCH = 50;

/**
 * Native local notifications for Android and iOS via @capacitor/local-notifications.
 * Notifications are held by the OS (AlarmManager on Android, UNUserNotificationCenter
 * on iOS) and fire while the app is closed. The Capacitor plugin re-registers
 * Android alarms after a device reboot (RECEIVE_BOOT_COMPLETED); on every app
 * start the scheduler additionally reconciles what the OS reports as pending.
 */
export class NativeNotificationAdapter implements NotificationAdapter {
  readonly kind = "native" as const;
  readonly maxPending: number;
  readonly reserve: number;

  constructor(readonly platform: Exclude<PlatformName, "web">) {
    this.maxPending = platform === "ios" ? IOS_PENDING_LIMIT : PLATFORM_LIMITS.android;
    this.reserve = platform === "ios" ? IOS_RESERVED_SLOTS : 10;
  }

  async init(handlers: NotificationHandlers) {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: IOS_CATEGORY,
          actions: [
            { id: "mark-wished", title: "Mark as wished" },
            { id: "snooze-1h", title: "Snooze 1 hour" },
            { id: "snooze-tomorrow", title: "Remind tomorrow" },
          ],
        },
      ],
    });
    if (this.platform === "android") {
      await ensureAllChannels({ sound: true, vibrate: true });
    }
    await LocalNotifications.removeAllListeners();
    await LocalNotifications.addListener("localNotificationActionPerformed", (ev) => {
      const id = ev.actionId === "tap" ? "tap" : (ev.actionId as NotificationActionId);
      const extra = isOurs(ev.notification.extra) ? (ev.notification.extra as NotificationExtra) : undefined;
      handlers.onAction(id, extra, ev.notification.title, ev.notification.body);
    });
  }

  async permission(): Promise<PermissionState> {
    const res = await LocalNotifications.checkPermissions();
    if (res.display === "granted") return "granted";
    if (res.display === "denied") return "denied";
    return "prompt";
  }

  async requestPermission(): Promise<PermissionState> {
    const res = await LocalNotifications.requestPermissions();
    if (res.display === "granted") return "granted";
    if (res.display === "denied") return "denied";
    return "prompt";
  }

  exactAlarmStatus() {
    return this.platform === "android" ? checkExactAlarm() : Promise.resolve("not-applicable" as const);
  }

  openExactAlarmSettings() {
    return this.platform === "android" ? openExactAlarmSettings() : Promise.resolve();
  }

  async getPending(): Promise<PendingInfo[]> {
    const { notifications } = await LocalNotifications.getPending();
    return notifications
      .filter((n) => isOurs(n.extra))
      .map((n) => {
        const extra = n.extra as NotificationExtra;
        const rawAt = (n.schedule?.at as unknown as string | Date | undefined) ?? extra.at;
        const at = rawAt ? new Date(rawAt) : undefined;
        return { id: n.id, title: n.title, at: at && !Number.isNaN(at.getTime()) ? at : undefined, extra };
      });
  }

  private async build(
    n: { id: number; title: string; body: string; at: Date; extra: NotificationExtra; channel: "reminders" | "celebration-day" | "snooze" },
    s: ScheduleSettings,
  ): Promise<LocalNotificationSchema> {
    const schema: LocalNotificationSchema = {
      id: n.id,
      title: n.title,
      body: n.body,
      largeBody: n.body,
      schedule: { at: n.at, allowWhileIdle: true },
      extra: n.extra,
      actionTypeId: IOS_CATEGORY,
      autoCancel: true,
      group: "birthdaybook",
      // Never prompt for exact alarms unless the user opted in to precise timing.
      isExactNotification: this.platform === "android" ? s.precise : undefined,
      isExactMandatory: false,
    };
    if (this.platform === "android") {
      schema.channelId = await ensureChannel(n.channel, s);
      schema.smallIcon = "ic_stat_birthdaybook";
      schema.iconColor = "#563B5C";
    } else {
      // iOS: sound/badge/banner style are owned by Settings › Notifications › BirthdayBook.
      schema.foreground = true;
    }
    return schema;
  }

  async schedule(list: PlannedNotification[], s: ScheduleSettings) {
    let warning: string | undefined;
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = await Promise.all(
        list.slice(i, i + BATCH).map((n) =>
          this.build({ id: n.id, title: n.title, body: n.body, at: n.at, extra: toExtra(n), channel: n.channel }, s),
        ),
      );
      const res = await LocalNotifications.schedule({ notifications: chunk });
      if (res.warning) warning = res.warning.message;
    }
    return { warning };
  }

  async cancel(ids: number[]) {
    for (let i = 0; i < ids.length; i += BATCH) {
      await LocalNotifications.cancel({ notifications: ids.slice(i, i + BATCH).map((id) => ({ id })) });
    }
  }

  async snooze(extra: NotificationExtra, title: string, body: string, at: Date, s: ScheduleSettings) {
    const id = stableNotificationId(`snooze:${extra.key}`);
    await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
    const schema = await this.build(
      { id, title, body, at, extra: { ...extra, kind: "snooze", at: at.toISOString() }, channel: "snooze" },
      s,
    );
    await LocalNotifications.schedule({ notifications: [schema] });
  }

  async sendTest(s: ScheduleSettings, inSeconds: number) {
    const at = new Date(Date.now() + inSeconds * 1000);
    const schema = await this.build(
      {
        id: stableNotificationId("test:birthdaybook"),
        title: "BirthdayBook test reminder",
        body: "If you can read this, reminders reach this device. You can close the app before it fires.",
        at,
        extra: { bb: 1, kind: "test", key: "test", at: at.toISOString() },
        channel: "celebration-day",
      },
      s,
    );
    await LocalNotifications.schedule({ notifications: [schema] });
  }
}
