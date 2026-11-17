import { LocalNotifications } from "@capacitor/local-notifications";
import type { ScheduleSettings } from "@/services/notifications/types";

/**
 * Android notification channels.
 *
 * Android (8+) freezes a channel's sound/vibration once it is created; the
 * app cannot change them afterwards. So each sound/vibration combination is
 * its own channel and we pick the one matching the user's current settings.
 * Users can still fine-tune every channel in system Settings.
 */
export type ChannelBase = "reminders" | "celebration-day" | "snooze";

const META: Record<ChannelBase, { name: string; description: string; importance: 3 | 4 | 5 }> = {
  reminders: {
    name: "Upcoming celebration reminders",
    description: "Heads-up reminders days before a birthday or occasion",
    importance: 4,
  },
  "celebration-day": {
    name: "Celebration day",
    description: "On-the-day alerts for birthdays and anniversaries",
    importance: 5,
  },
  snooze: {
    name: "Snoozed reminders",
    description: "Reminders you snoozed from a notification",
    importance: 4,
  },
};

export function channelId(base: ChannelBase, s: Pick<ScheduleSettings, "sound" | "vibrate">): string {
  return `bb-${base}-${s.sound ? "s" : "q"}${s.vibrate ? "v" : "n"}`;
}

const created = new Set<string>();

export async function ensureChannel(base: ChannelBase, s: Pick<ScheduleSettings, "sound" | "vibrate">) {
  const id = channelId(base, s);
  if (created.has(id)) return id;
  const meta = META[base];
  await LocalNotifications.createChannel({
    id,
    name: `${meta.name}${s.sound ? "" : " (silent)"}`,
    description: meta.description,
    importance: meta.importance,
    visibility: 1, // public on lock screen
    lights: true,
    lightColor: "#E78B79",
    vibration: s.vibrate,
    // Omitting `sound` uses the system default notification sound; an empty
    // string would refer to a missing res/raw file, so silent channels use
    // importance-preserving `sound: undefined` + vibration only.
    ...(s.sound ? {} : { sound: "silence.wav" }),
  });
  created.add(id);
  return id;
}

export async function ensureAllChannels(s: Pick<ScheduleSettings, "sound" | "vibrate">) {
  for (const base of Object.keys(META) as ChannelBase[]) await ensureChannel(base, s);
}

export async function checkExactAlarm(): Promise<"granted" | "denied" | "not-applicable"> {
  try {
    const res = await LocalNotifications.checkExactNotificationSetting();
    return res.exact_alarm === "granted" ? "granted" : "denied";
  } catch {
    return "not-applicable"; // Android < 12
  }
}

export async function openExactAlarmSettings() {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* not available on this Android version */
  }
}
