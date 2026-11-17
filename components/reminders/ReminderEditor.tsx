"use client";

import { useMemo, useState } from "react";
import { BellPlus, CalendarClock, Trash2 } from "lucide-react";
import type { ReminderRule, TargetKind } from "@/types";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Input, Select } from "@/components/ui/primitives";
import { offsetLabel, planNotifications } from "@/services/reminders/planner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const OFFSETS = [0, 1, 2, 3, 5, 7, 10, 14, 21, 30];

export function ReminderEditor({ targetKind, targetId }: { targetKind: TargetKind; targetId: string }) {
  const { data, repo, scheduler } = useApp();
  const rules = data.reminders
    .filter((r) => r.targetKind === targetKind && r.targetId === targetId)
    .sort((a, b) => (a.customDate ? 1 : 0) - (b.customDate ? 1 : 0) || b.offsetDays - a.offsetDays);
  const [customDate, setCustomDate] = useState("");

  // Next fire time per rule, from the same planner the OS scheduler uses.
  const nextFire = useMemo(() => {
    const plan = planNotifications(data, { now: new Date(), windowDays: 400, maxPending: 10_000 });
    const map = new Map<string, Date>();
    for (const n of plan) if (n.targetId === targetId && !map.has(n.ruleId)) map.set(n.ruleId, n.at);
    return map;
  }, [data, targetId]);

  const confirmed = new Set(scheduler?.state.scheduled.filter((s) => s.confirmed).map((s) => s.key.split(":").pop()) ?? []);

  const update = (r: ReminderRule, patch: Partial<ReminderRule>) => repo.upsert("reminders", { ...r, ...patch });

  return (
    <div className="space-y-2">
      {rules.length === 0 && <p className="px-1 py-2 text-sm text-ink-muted">No reminders yet. Add one below.</p>}
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {rules.map((r) => {
          const next = nextFire.get(r.id);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 p-3">
              <button
                role="switch"
                aria-checked={r.enabled}
                aria-label={`${r.enabled ? "Disable" : "Enable"} reminder`}
                onClick={() => update(r, { enabled: !r.enabled })}
                className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", r.enabled ? "bg-plum" : "bg-line-strong")}
              >
                <span className={cn("absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform", r.enabled && "translate-x-5")} />
              </button>
              {r.customDate ? (
                <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] text-ink">
                  <CalendarClock className="size-4 text-plum" aria-hidden />
                  {format(new Date(`${r.customDate}T00:00`), "d MMM yyyy")}
                </span>
              ) : (
                <Select aria-label="When" className="h-10 w-auto min-w-36 flex-1" value={r.offsetDays} onChange={(e) => update(r, { offsetDays: Number(e.target.value) })}>
                  {[...new Set([...OFFSETS, r.offsetDays])].sort((a, b) => a - b).map((o) => (
                    <option key={o} value={o}>
                      {offsetLabel(o)}
                    </option>
                  ))}
                </Select>
              )}
              <Input aria-label="Time" type="time" className="h-10 w-28" value={r.time} onChange={(e) => e.target.value && update(r, { time: e.target.value })} />
              <Button size="icon" variant="ghost" aria-label="Delete reminder" onClick={() => repo.remove("reminders", r.id)} className="size-10">
                <Trash2 className="size-4" aria-hidden />
              </Button>
              <p className="w-full pl-14 text-xs text-ink-muted">
                {!r.enabled
                  ? "Off"
                  : next
                    ? `Next: ${format(next, next.getFullYear() === new Date().getFullYear() ? "EEE d MMM, HH:mm" : "EEE d MMM yyyy, HH:mm")}${confirmed.has(r.id) ? " · confirmed by system" : ""}`
                    : "Nothing upcoming in the scheduling window"}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="soft" icon={BellPlus} onClick={() => repo.addReminder(targetKind, targetId, { offsetDays: 2 })}>
          Add reminder
        </Button>
        <div className="flex items-center gap-2">
          <Input aria-label="Custom reminder date" type="date" className="h-9 w-40 text-sm" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          <Button
            size="sm"
            variant="secondary"
            disabled={!customDate}
            onClick={async () => {
              await repo.addReminder(targetKind, targetId, { customDate, offsetDays: 0, label: "Reminder" });
              setCustomDate("");
            }}
          >
            Add on date
          </Button>
        </div>
      </div>
    </div>
  );
}
