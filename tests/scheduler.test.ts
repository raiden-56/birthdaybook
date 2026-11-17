import { describe, expect, it, beforeEach } from "vitest";
import { diffSchedule, planNotifications, scheduleFingerprint } from "@/services/reminders/planner";
import { ReminderScheduler, computeHealth } from "@/services/reminders/scheduler";
import { BirthdayRepository } from "@/services/storage/repository";
import { MemoryAdapter } from "@/services/storage/adapter";
import type { NotificationAdapter, PendingInfo, PermissionState } from "@/services/notifications/types";
import { toExtra } from "@/services/notifications/types";
import type { PlannedNotification } from "@/types";
import { stableNotificationId } from "@/lib/utils";
import { data, person, rule } from "./helpers";

const NOW = new Date(2026, 10, 17, 8, 0); // 17 Nov 2026 08:00 local

describe("planner", () => {
  it("creates one notification per enabled rule", () => {
    const p = person({ id: "a", birthMonth: 11, birthDay: 30 });
    const d = data({ people: [p], reminders: [rule("a", 7), rule("a", 3), rule("a", 1), rule("a", 0)] });
    const plan = planNotifications(d, { now: NOW, windowDays: 60, maxPending: 64 });
    expect(plan.map((n) => n.offsetDays)).toEqual([7, 3, 1, 0]);
    expect(plan[0].at).toEqual(new Date(2026, 10, 23, 9, 0));
    expect(plan[3].at).toEqual(new Date(2026, 10, 30, 9, 0));
    expect(plan[3].channel).toBe("celebration-day");
  });

  it("uses stable ids so re-planning never duplicates", () => {
    const p = person({ id: "a", birthMonth: 11, birthDay: 30 });
    const d = data({ people: [p], reminders: [rule("a", 1)] });
    const a = planNotifications(d, { now: NOW, windowDays: 60, maxPending: 64 });
    const b = planNotifications(d, { now: new Date(NOW.getTime() + 3600_000), windowDays: 60, maxPending: 64 });
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].id).toBe(stableNotificationId("person:a:2026:r-a-1"));
    expect(a[0].id).toBeGreaterThan(0);
    expect(a[0].id).toBeLessThanOrEqual(0x7fffffff);
  });

  it("skips disabled rules and reminders in the past", () => {
    const p = person({ id: "a", birthMonth: 11, birthDay: 18 });
    const d = data({ people: [p], reminders: [rule("a", 7), rule("a", 1, { enabled: false }), rule("a", 0)] });
    const plan = planNotifications(d, { now: NOW, windowDays: 60, maxPending: 64 });
    expect(plan).toHaveLength(1);
    expect(plan[0].offsetDays).toBe(0);
  });

  it("schedules a reminder later today if its time has not passed", () => {
    const p = person({ id: "a", birthMonth: 11, birthDay: 17 });
    const d = data({ people: [p], reminders: [rule("a", 0, { time: "09:00" })] });
    const plan = planNotifications(d, { now: NOW, windowDays: 30, maxPending: 64 });
    expect(plan).toHaveLength(1);
    expect(plan[0].eventYear).toBe(2026);
  });

  it("respects the platform cap and keeps the soonest", () => {
    const people = Array.from({ length: 40 }, (_, i) => person({ id: `p${i}`, birthMonth: 12, birthDay: (i % 28) + 1 }));
    const reminders = people.flatMap((p) => [rule(p.id, 7), rule(p.id, 0)]);
    const plan = planNotifications(data({ people, reminders }), { now: NOW, windowDays: 120, maxPending: 64, reserve: 4 });
    expect(plan).toHaveLength(60);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThanOrEqual(plan[i - 1].at.getTime());
  });

  it("supports custom one-off reminder dates", () => {
    const p = person({ id: "a", birthMonth: 12, birthDay: 10 });
    const d = data({ people: [p], reminders: [rule("a", 0, { customDate: "2026-12-01", time: "18:30", label: "Order cake" })] });
    const [n] = planNotifications(d, { now: NOW, windowDays: 60, maxPending: 64 });
    expect(n.at).toEqual(new Date(2026, 11, 1, 18, 30));
    expect(n.title).toContain("Order cake");
    expect(n.offsetDays).toBe(9);
  });

  it("handles leap-day birthdays in a non-leap year", () => {
    const p = person({ id: "leap", birthMonth: 2, birthDay: 29 });
    const d = data({ people: [p], reminders: [rule("leap", 0)] });
    const plan = planNotifications(d, { now: new Date(2027, 1, 1), windowDays: 60, maxPending: 64 });
    expect(plan[0].at).toEqual(new Date(2027, 1, 28, 9, 0));
    d.preferences.leapPolicy = "mar1";
    const plan2 = planNotifications(d, { now: new Date(2027, 1, 1), windowDays: 60, maxPending: 64 });
    expect(plan2[0].at).toEqual(new Date(2027, 2, 1, 9, 0));
  });

  it("covers the year boundary", () => {
    const p = person({ id: "a", birthMonth: 1, birthDay: 2 });
    const d = data({ people: [p], reminders: [rule("a", 7)] });
    const [n] = planNotifications(d, { now: new Date(2026, 11, 20), windowDays: 30, maxPending: 64 });
    expect(n.at).toEqual(new Date(2026, 11, 26, 9, 0));
    expect(n.eventYear).toBe(2027);
  });
});

describe("diffSchedule", () => {
  const mk = (id: number, at: Date) => ({ id, at }) as PlannedNotification;

  it("leaves matching notifications alone and cancels stale ones", () => {
    const t = new Date(2026, 11, 1, 9);
    const r = diffSchedule([mk(1, t), mk(2, t)], [{ id: 1, at: t }, { id: 3, at: t }]);
    expect(r.unchanged).toEqual([1]);
    expect(r.toSchedule.map((x) => x.id)).toEqual([2]);
    expect(r.toCancel).toEqual([3]);
  });

  it("reschedules when the fire time moved (timezone or edit)", () => {
    const r = diffSchedule([mk(1, new Date(2026, 11, 1, 10))], [{ id: 1, at: new Date(2026, 11, 1, 9) }]);
    expect(r.toCancel).toEqual([1]);
    expect(r.toSchedule).toHaveLength(1);
  });
});

/** Fake OS notification centre that can be told to drop notifications. */
class FakeAdapter implements NotificationAdapter {
  platform = "android" as const;
  kind = "native" as const;
  maxPending = 400;
  reserve = 0;
  pending = new Map<number, PendingInfo>();
  perm: PermissionState = "granted";
  scheduleCalls = 0;
  dropIds = new Set<number>();
  async init() {}
  async permission() {
    return this.perm;
  }
  async requestPermission() {
    return this.perm;
  }
  async exactAlarmStatus() {
    return "not-applicable" as const;
  }
  async openExactAlarmSettings() {}
  async getPending() {
    return [...this.pending.values()];
  }
  async schedule(list: PlannedNotification[]) {
    this.scheduleCalls += list.length;
    for (const n of list) if (!this.dropIds.has(n.id)) this.pending.set(n.id, { id: n.id, at: n.at, extra: toExtra(n) });
    return {};
  }
  async cancel(ids: number[]) {
    for (const id of ids) this.pending.delete(id);
  }
  async snooze() {}
  async sendTest() {}
}

describe("ReminderScheduler.reconcile", () => {
  let repo: BirthdayRepository;
  let os: FakeAdapter;
  let scheduler: ReminderScheduler;

  beforeEach(async () => {
    repo = new BirthdayRepository(new MemoryAdapter());
    await repo.init();
    os = new FakeAdapter();
    scheduler = new ReminderScheduler(repo, os);
    const birthday = new Date();
    birthday.setDate(birthday.getDate() + 20);
    await repo.addPerson({
      firstName: "Asha",
      lastName: "Verma",
      relationship: "friend",
      birthMonth: birthday.getMonth() + 1,
      birthDay: birthday.getDate(),
      tags: [],
      favorite: false,
    });
  });

  it("schedules default 7/3/1/0 reminders and confirms them", async () => {
    const r = await scheduler.reconcile("test");
    expect(r.planned).toBe(4);
    expect(r.confirmed).toBe(4);
    expect(os.pending.size).toBe(4);
    expect(scheduler.health(repo.getSnapshot(), "granted")).toBe("enabled");
  });

  it("is idempotent – a second run schedules nothing new", async () => {
    await scheduler.reconcile("first");
    const calls = os.scheduleCalls;
    const r = await scheduler.reconcile("second");
    expect(r.scheduled).toBe(0);
    expect(os.scheduleCalls).toBe(calls);
    expect(os.pending.size).toBe(4);
  });

  it("cancels reminders after a person is deleted", async () => {
    await scheduler.reconcile("first");
    await repo.deletePerson(repo.getSnapshot().people[0].id);
    expect(scheduler.health(repo.getSnapshot(), "granted")).toBe("needs-refresh");
    const r = await scheduler.reconcile("after delete");
    expect(r.cancelled).toBe(4);
    expect(os.pending.size).toBe(0);
  });

  it("reschedules after a reminder time edit", async () => {
    await scheduler.reconcile("first");
    const rule0 = repo.getSnapshot().reminders.find((r) => r.offsetDays === 0)!;
    await repo.upsert("reminders", { ...rule0, time: "20:15" });
    await scheduler.reconcile("edit");
    const n = [...os.pending.values()].find((p) => p.at?.getHours() === 20);
    expect(n?.at?.getMinutes()).toBe(15);
    expect(os.pending.size).toBe(4);
  });

  it("never reports unconfirmed notifications as scheduled", async () => {
    const plan = planNotifications(repo.getSnapshot(), { now: new Date(), windowDays: 120, maxPending: 400 });
    os.dropIds.add(plan[0].id);
    const r = await scheduler.reconcile("drop");
    expect(r.confirmed).toBe(3);
    expect(r.unconfirmed).toBe(1);
    expect(r.ok).toBe(false);
    expect(scheduler.health(repo.getSnapshot(), "granted")).toBe("needs-refresh");
  });

  it("does not schedule without permission", async () => {
    os.perm = "denied";
    const r = await scheduler.reconcile("denied");
    expect(r.planned).toBe(0);
    expect(os.pending.size).toBe(0);
    expect(scheduler.health(repo.getSnapshot(), "denied")).toBe("disabled");
    expect(scheduler.health(repo.getSnapshot(), "prompt")).toBe("permission-required");
  });
});

describe("computeHealth", () => {
  it("needs refresh after a timezone change", () => {
    const d = data();
    const state = { lastReconciledAt: new Date().toISOString(), lastTimezone: "Asia/Kolkata", lastDataHash: scheduleFingerprint(d), scheduled: [] };
    expect(computeHealth(d, state, "granted", "Asia/Kolkata", new Date())).toBe("enabled");
    expect(computeHealth(d, state, "granted", "Europe/London", new Date())).toBe("needs-refresh");
  });

  it("needs refresh when the last reconcile is older than a day", () => {
    const d = data();
    const old = new Date(Date.now() - 2 * 86400_000).toISOString();
    const state = { lastReconciledAt: old, lastTimezone: "UTC", lastDataHash: scheduleFingerprint(d), scheduled: [] };
    expect(computeHealth(d, state, "granted", "UTC", new Date())).toBe("needs-refresh");
  });
});
