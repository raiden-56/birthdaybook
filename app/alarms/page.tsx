"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlarmClock,
  BatteryWarning,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  CircleAlert,
  Download,
  Globe,
  PauseCircle,
  RefreshCw,
  Send,
  Smartphone,
  Timer,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Badge, Button, Card, CardHeader, Input, PageHeader, Spinner, Switch } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { HEALTH_META, HealthBadge } from "@/components/reminders/HealthBadge";
import { offsetLabel } from "@/services/reminders/planner";
import { buildIcs } from "@/services/calendar/ics";
import { saveFile } from "@/services/backup/files";
import { exportFileName } from "@/services/excel/workbook";
import { PLATFORM_LABEL } from "@/platform";
import { IOS_PENDING_LIMIT } from "@/platform/ios/notifications";
import { currentTimezone, cn } from "@/lib/utils";

const OFFSET_CHOICES = [30, 14, 7, 3, 1, 0];

export default function AlarmCentre() {
  const app = useApp();
  const { ready, data, repo, scheduler, platform, permission, health, exactAlarm, lastResult, reconcile, requestPermission, refreshPermission, toast } = app;
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const prefs = data.preferences;
  const state = scheduler?.state;
  const booked = useMemo(() => (state?.scheduled ?? []).slice().sort((a, b) => a.at.localeCompare(b.at)), [state]);
  const confirmed = booked.filter((b) => b.confirmed).length;
  const horizon = booked.length ? new Date(booked[booked.length - 1].at) : undefined;
  const isNative = platform !== "web";
  const meta = HEALTH_META[health];

  if (!ready) return <Spinner />;

  async function refresh() {
    setBusy(true);
    const res = await reconcile("alarm centre");
    setBusy(false);
    if (!res) return;
    if (res.error) toast({ tone: "danger", title: "Couldn't refresh", body: res.error });
    else if (res.permission !== "granted") toast({ tone: "warning", title: "Notifications aren't allowed yet" });
    else if (res.unconfirmed) toast({ tone: "warning", title: `${res.confirmed} of ${res.planned} confirmed`, body: "The system didn't accept every reminder. Check notification settings." });
    else toast({ tone: "success", title: "Schedule refreshed", body: `${res.confirmed} reminder${res.confirmed === 1 ? "" : "s"} confirmed by the system.` });
  }

  async function sendTest() {
    if (!scheduler) return;
    if (permission !== "granted") {
      const p = await requestPermission();
      if (p !== "granted") return;
    }
    await scheduler.adapter.sendTest({ precise: prefs.preciseAlarms, sound: prefs.notificationSound, vibrate: prefs.notificationVibrate }, 10);
    toast({ tone: "info", title: "Test reminder in 10 seconds", body: isNative ? "Lock the phone or close the app to check it arrives." : "Keep this tab open." });
  }

  const toggleOffset = (o: number) => {
    const set = new Set(prefs.defaultOffsets);
    if (set.has(o)) set.delete(o);
    else set.add(o);
    void repo.setPreferences({ defaultOffsets: [...set].sort((a, b) => b - a) });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Alarm Centre" title="Reminders & notifications" description="What's booked with your device, and whether it will actually reach you." />

      {/* Health hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", health === "enabled" ? "bg-green-soft text-green-ink" : health === "disabled" ? "bg-danger-soft text-danger" : "bg-coral-soft text-coral-ink")}>
            <meta.icon className="size-7" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <HealthBadge />
            <p className="mt-2 text-[15px] text-ink">{meta.body}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {PLATFORM_LABEL[platform]} · {isNative ? "Native local notifications" : "Browser notifications"} · {currentTimezone()}
              {state?.lastReconciledAt && ` · refreshed ${formatDistanceToNow(new Date(state.lastReconciledAt), { addSuffix: true })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(permission === "prompt" || health === "permission-required") && (
              <Button icon={BellRing} onClick={async () => (await requestPermission()) === "granted" && toast({ tone: "success", title: "Notifications allowed" })}>
                Allow notifications
              </Button>
            )}
            {permission === "granted" && (
              <Button icon={RefreshCw} loading={busy} onClick={refresh} variant={health === "needs-refresh" ? "primary" : "secondary"}>
                Refresh schedule
              </Button>
            )}
            {(permission === "granted" || permission === "prompt") && (
              <Button variant="secondary" icon={Send} onClick={sendTest}>
                Send test
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <Metric label="Booked" value={booked.length} />
          <Metric label="Confirmed by system" value={permission === "granted" ? confirmed : "—"} tone={confirmed < booked.length ? "warn" : undefined} />
          <Metric label="Covers until" value={horizon ? format(horizon, "d MMM") : "—"} />
          <Metric label="Window" value={`${prefs.scheduleWindowDays} days`} />
        </div>
        {(state?.lastError || state?.lastWarning || lastResult?.warning) && permission === "granted" && (
          <p className="flex items-start gap-2 border-t border-line bg-amber-soft px-5 py-3 text-sm text-amber-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state?.lastWarning ?? lastResult?.warning ?? state?.lastError}
          </p>
        )}
      </Card>

      {permission === "denied" && (
        <Card className="border-danger/30 p-5">
          <h2 className="font-semibold text-ink">Notifications are blocked</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] text-ink-muted">
            {platform === "android" && (
              <>
                <li>Open Settings → Apps → BirthdayBook → Notifications.</li>
                <li>Turn on &ldquo;All BirthdayBook notifications&rdquo;.</li>
              </>
            )}
            {platform === "ios" && (
              <>
                <li>Open Settings → Notifications → BirthdayBook.</li>
                <li>Turn on Allow Notifications, and choose Banners, Sounds and Badges.</li>
              </>
            )}
            {platform === "web" && (
              <>
                <li>Click the lock or tune icon left of the address bar.</li>
                <li>Set Notifications to Allow, then reload this page.</li>
              </>
            )}
            <li>Come back here. BirthdayBook re-checks automatically.</li>
          </ol>
          <Button className="mt-4" variant="secondary" onClick={refreshPermission}>
            I&apos;ve changed it
          </Button>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Native vs web */}
        <Card>
          <CardHeader title={isNative ? "Native alarms on this phone" : "Browser notifications"} icon={isNative ? Smartphone : Globe} />
          <div className="space-y-3 px-5 pb-5 text-[15px] text-ink-muted">
            {isNative ? (
              <>
                <p>
                  Reminders are handed to {platform === "ios" ? "iOS" : "Android"} and fire while BirthdayBook is closed. After a restart
                  {platform === "android" ? ", Android restores them automatically" : ", iOS keeps them"}, and BirthdayBook re-checks every time you open it.
                </p>
                <p>Only reminders the system confirms count as booked. Permissions, Focus or Do Not Disturb modes and battery savers can still hold a notification back.</p>
              </>
            ) : (
              <>
                <p>
                  <strong className="text-ink">Browsers can&apos;t book alarms with the operating system.</strong> Web reminders fire only while a BirthdayBook tab or the installed app is
                  running. Anything missed in the last 12 hours shows when you return.
                </p>
                <p>For reminders that arrive with the browser closed, export the calendar file below, or install the Android or iPhone app.</p>
                <Button
                  variant="soft"
                  icon={Download}
                  onClick={async () => {
                    const r = await saveFile(buildIcs(data), exportFileName("ics"), "text/calendar");
                    if (r.method !== "cancelled") toast({ tone: "success", title: "Calendar exported", body: "Import it into Google Calendar or Apple Calendar. Alarms are included." });
                  }}
                >
                  Export to Google / Apple Calendar
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Platform specifics */}
        {platform === "android" && (
          <Card>
            <CardHeader title="Android delivery" icon={AlarmClock} />
            <div className="space-y-4 px-5 pb-5">
              <Switch
                checked={prefs.preciseAlarms}
                onChange={async (v) => {
                  await repo.setPreferences({ preciseAlarms: v });
                  if (v && exactAlarm === "denied") {
                    toast({ tone: "info", title: "Allow “Alarms & reminders”", body: "Android opens the setting. Turn it on, then come back." });
                    await scheduler?.adapter.openExactAlarmSettings();
                  }
                }}
                label="Precise timing"
                description="Fires at the exact minute. Off is fine for birthdays: Android may deliver a few minutes late to save battery."
              />
              {prefs.preciseAlarms && (
                <p className="text-sm text-ink-muted">
                  Exact alarm permission:{" "}
                  <Badge tone={exactAlarm === "granted" ? "green" : exactAlarm === "denied" ? "amber" : "neutral"}>{exactAlarm === "not-applicable" ? "not needed on this Android version" : exactAlarm}</Badge>
                  {exactAlarm === "denied" && (
                    <Button size="sm" variant="ghost" className="ml-2" onClick={() => scheduler?.adapter.openExactAlarmSettings()}>
                      Open setting
                    </Button>
                  )}
                </p>
              )}
              <div className="flex gap-3 rounded-xl bg-surface-2 p-3 text-sm text-ink-muted">
                <BatteryWarning className="mt-0.5 size-5 shrink-0 text-amber-ink" aria-hidden />
                <p>
                  Some phones (Xiaomi, Oppo, Vivo, Realme, OnePlus, Samsung) stop background alarms aggressively. If reminders arrive late, set Settings → Battery → BirthdayBook to
                  &ldquo;Unrestricted&rdquo; and allow Autostart.
                </p>
              </div>
              <Switch checked={prefs.notificationSound} onChange={(v) => repo.setPreferences({ notificationSound: v })} label="Sound" />
              <Switch checked={prefs.notificationVibrate} onChange={(v) => repo.setPreferences({ notificationVibrate: v })} label="Vibrate" />
              <p className="text-xs text-ink-muted">Android channels: &ldquo;Upcoming celebration reminders&rdquo;, &ldquo;Celebration day&rdquo; and &ldquo;Snoozed reminders&rdquo;. You can fine-tune each in system settings.</p>
            </div>
          </Card>
        )}
        {platform === "ios" && (
          <Card>
            <CardHeader title="iPhone limits" icon={Timer} />
            <div className="space-y-3 px-5 pb-5 text-[15px] text-ink-muted">
              <p>
                iOS holds at most <strong className="text-ink">{IOS_PENDING_LIMIT}</strong> scheduled notifications per app. BirthdayBook books the soonest 60 and keeps 4 free for snoozes
                and tests.
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={IOS_PENDING_LIMIT} aria-valuenow={booked.length} aria-label="iOS notification slots used">
                <div className="h-full rounded-full bg-plum" style={{ width: `${Math.min(100, (booked.length / IOS_PENDING_LIMIT) * 100)}%` }} />
              </div>
              <p className="text-sm">
                {booked.length} of {IOS_PENDING_LIMIT} used{horizon ? `, reaching ${format(horizon, "d MMMM")}` : ""}. Opening BirthdayBook tops up the window, so open it now and then.
              </p>
              <p className="text-sm">Sound, badges and banner style are set in Settings → Notifications → BirthdayBook.</p>
            </div>
          </Card>
        )}
        {platform === "web" && (
          <Card>
            <CardHeader title="Install as an app" icon={CalendarCheck2} />
            <div className="space-y-2 px-5 pb-5 text-[15px] text-ink-muted">
              <p>Installing BirthdayBook gives it its own window and lets it work fully offline.</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>Chrome / Edge: the install icon in the address bar, or ⋮ → Install BirthdayBook.</li>
                <li>Safari on iPhone: Share → Add to Home Screen. Notifications need iOS 16.4 or later and only work from the home-screen app.</li>
              </ul>
            </div>
          </Card>
        )}

        {/* Defaults */}
        <Card>
          <CardHeader title="Default reminders" description="Used for new people and occasions" icon={BellRing} />
          <div className="space-y-4 px-5 pb-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Default reminder offsets">
              {OFFSET_CHOICES.map((o) => {
                const on = prefs.defaultOffsets.includes(o);
                return (
                  <button
                    key={o}
                    aria-pressed={on}
                    onClick={() => toggleOffset(o)}
                    className={cn("min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors", on ? "border-plum bg-plum-soft text-plum" : "border-line-strong text-ink-muted hover:text-ink")}
                  >
                    {offsetLabel(o)}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-ink">Reminder time</span>
              <Input type="time" className="w-32" value={prefs.defaultTime} onChange={(e) => e.target.value && repo.setPreferences({ defaultTime: e.target.value })} />
            </label>
            <Button
              variant="secondary"
              onClick={async () => {
                const n = await repo.applyDefaultRemindersToAll();
                toast({ tone: n ? "success" : "info", title: n ? `Added ${n} reminders` : "Everyone already has reminders" });
              }}
            >
              Give everyone without reminders these defaults
            </Button>
          </div>
        </Card>

        {/* Booked list */}
        <Card className="lg:col-span-2">
          <CardHeader title="Booked with the system" description="Soonest first" icon={CheckCircle2} />
          <div className="px-5 pb-5">
            {booked.length === 0 ? (
              <p className="text-sm text-ink-muted">{permission === "granted" ? "Nothing booked in the current window." : "Allow notifications to book reminders."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {booked.slice(0, 40).map((b) => (
                  <li key={b.id} className="flex min-h-12 items-center gap-3 py-2">
                    <span className="w-28 shrink-0 text-sm text-ink-muted tabular-nums sm:w-36">{format(new Date(b.at), "EEE d MMM, HH:mm")}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{b.title}</span>
                    {b.confirmed ? <Badge tone="green">Confirmed</Badge> : <Badge tone="amber">Not confirmed</Badge>}
                  </li>
                ))}
              </ul>
            )}
            {booked.length > 40 && <p className="mt-2 text-sm text-ink-muted">and {booked.length - 40} more…</p>}
            {permission === "granted" && booked.length > 0 && (
              <Button className="mt-4" variant="ghost" icon={PauseCircle} onClick={() => setPauseOpen(true)}>
                Cancel all booked notifications
              </Button>
            )}
          </div>
        </Card>
      </div>

      <ConfirmSheet
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Cancel all booked notifications?"
        body="Everything BirthdayBook booked with the system is removed. Your reminder settings stay, and Refresh schedule books them again."
        confirmLabel="Cancel them"
        danger
        onConfirm={async () => {
          await scheduler?.cancelAll();
          await refreshPermission();
          toast({ tone: "info", title: "All notifications cancelled" });
        }}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={cn("font-display text-xl font-semibold tabular-nums", tone === "warn" ? "text-amber-ink" : "text-ink")}>{value}</p>
    </div>
  );
}
