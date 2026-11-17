import { addDays, startOfDay } from "date-fns";
import type { BirthdayBookData, ReminderHealth, ScheduledRecord, SchedulerState } from "@/types";
import type { BirthdayRepository } from "@/services/storage/repository";
import type { NotificationAdapter, NotificationExtra, PermissionState } from "@/services/notifications/types";
import { diffSchedule, planNotifications, scheduleFingerprint } from "./planner";
import { currentTimezone } from "@/lib/utils";

const STATE_KEY = "scheduler-state";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ReconcileResult {
  ok: boolean;
  permission: PermissionState;
  planned: number;
  scheduled: number;
  cancelled: number;
  unchanged: number;
  confirmed: number;
  unconfirmed: number;
  horizon?: string;
  warning?: string;
  error?: string;
}

/**
 * Reminder scheduling engine.
 *
 *  1. read records from the repository
 *  2. compute next occurrences and reminder fire times (planner)
 *  3. ask the OS what is already pending
 *  4. cancel stale/edited notifications, schedule missing ones
 *  5. re-read the OS pending list and record only what the OS confirmed
 *
 * Reconciliation is idempotent and serialised, so it is safe to call on app
 * start, on resume, after every edit and after a timezone change.
 */
export class ReminderScheduler {
  private running: Promise<ReconcileResult> | null = null;
  private queued = false;
  state: SchedulerState = { scheduled: [] };

  constructor(
    private repo: BirthdayRepository,
    readonly adapter: NotificationAdapter,
  ) {}

  async loadState() {
    this.state = (await this.repo.getMeta<SchedulerState>(STATE_KEY)) ?? { scheduled: [] };
    return this.state;
  }

  private async saveState(patch: Partial<SchedulerState>) {
    this.state = { ...this.state, ...patch };
    await this.repo.setMeta(STATE_KEY, this.state);
  }

  /** Coalesces concurrent calls: at most one running + one queued. */
  reconcile(reason = "manual"): Promise<ReconcileResult> {
    if (this.running) {
      this.queued = true;
      return this.running;
    }
    this.running = this.doReconcile(reason).finally(() => {
      this.running = null;
      if (this.queued) {
        this.queued = false;
        void this.reconcile("queued");
      }
    });
    return this.running;
  }

  private async doReconcile(reason: string): Promise<ReconcileResult> {
    const data = this.repo.getSnapshot();
    const prefs = data.preferences;
    const tz = currentTimezone();
    const base: ReconcileResult = {
      ok: false,
      permission: "prompt",
      planned: 0,
      scheduled: 0,
      cancelled: 0,
      unchanged: 0,
      confirmed: 0,
      unconfirmed: 0,
    };

    try {
      const permission = await this.adapter.permission();
      base.permission = permission;
      if (permission !== "granted") {
        await this.saveState({ lastError: permission === "unsupported" ? "Notifications are not supported here" : "Notification permission not granted" });
        return base;
      }

      const now = new Date();
      const plan = planNotifications(data, {
        now,
        windowDays: prefs.scheduleWindowDays,
        maxPending: this.adapter.maxPending,
        reserve: this.adapter.reserve,
      });
      const pending = (await this.adapter.getPending()).filter((p) => p.extra?.kind === "reminder");
      const diff = diffSchedule(plan, pending);

      if (diff.toCancel.length) await this.adapter.cancel(diff.toCancel);
      const settings = { precise: prefs.preciseAlarms, sound: prefs.notificationSound, vibrate: prefs.notificationVibrate };
      const { warning } = diff.toSchedule.length ? await this.adapter.schedule(diff.toSchedule, settings) : { warning: undefined };

      // Verify against the OS. Only confirmed ids are reported as scheduled.
      const after = new Set((await this.adapter.getPending()).map((p) => p.id));
      const records: ScheduledRecord[] = plan.map((n) => ({
        id: n.id,
        key: n.key,
        at: n.at.toISOString(),
        title: n.title,
        targetId: n.targetId,
        confirmed: after.has(n.id),
      }));
      const confirmed = records.filter((r) => r.confirmed).length;
      const horizon = plan.length ? plan[plan.length - 1].at.toISOString() : addDays(startOfDay(now), prefs.scheduleWindowDays).toISOString();

      await this.saveState({
        lastReconciledAt: now.toISOString(),
        lastTimezone: tz,
        lastDataHash: scheduleFingerprint(data),
        platform: this.adapter.platform,
        scheduled: records,
        lastError: confirmed < records.length ? `${records.length - confirmed} reminders were not confirmed by the system` : undefined,
        lastWarning: warning,
      });
      if (prefs.lastKnownTimezone !== tz) await this.repo.setPreferences({ lastKnownTimezone: tz });

      console.info(`[BirthdayBook] reconcile (${reason}): planned ${plan.length}, +${diff.toSchedule.length} −${diff.toCancel.length}, confirmed ${confirmed}`);
      return {
        ok: confirmed === records.length,
        permission,
        planned: plan.length,
        scheduled: diff.toSchedule.length,
        cancelled: diff.toCancel.length,
        unchanged: diff.unchanged.length,
        confirmed,
        unconfirmed: records.length - confirmed,
        horizon,
        warning,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.saveState({ lastError: message }).catch(() => undefined);
      return { ...base, error: message };
    }
  }

  /** Cancel everything BirthdayBook scheduled (used when the user turns reminders off). */
  async cancelAll() {
    const pending = await this.adapter.getPending();
    await this.adapter.cancel(pending.map((p) => p.id));
    // Clearing the fingerprint makes health report "needs refreshing" – honest, since nothing is booked.
    await this.saveState({ scheduled: [], lastDataHash: undefined });
  }

  health(data: BirthdayBookData, permission: PermissionState): ReminderHealth {
    return computeHealth(data, this.state, permission, currentTimezone(), new Date());
  }

  async snooze(extra: NotificationExtra, title: string, body: string, minutes: number) {
    const prefs = this.repo.getSnapshot().preferences;
    const at = new Date(Date.now() + minutes * 60_000);
    await this.adapter.snooze(extra, title, body, at, {
      precise: prefs.preciseAlarms,
      sound: prefs.notificationSound,
      vibrate: prefs.notificationVibrate,
    });
    return at;
  }
}

export function computeHealth(
  data: BirthdayBookData,
  state: SchedulerState,
  permission: PermissionState,
  tz: string,
  now: Date,
): ReminderHealth {
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "disabled";
  if (permission === "prompt") return "permission-required";
  if (!state.lastReconciledAt) return "needs-refresh";
  if (state.lastTimezone && state.lastTimezone !== tz) return "needs-refresh";
  if (state.lastDataHash !== scheduleFingerprint(data)) return "needs-refresh";
  if (now.getTime() - new Date(state.lastReconciledAt).getTime() > STALE_AFTER_MS) return "needs-refresh";
  if (state.scheduled.some((s) => !s.confirmed)) return "needs-refresh";
  return "enabled";
}
