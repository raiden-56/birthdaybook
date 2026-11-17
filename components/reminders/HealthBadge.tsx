"use client";

import { BellOff, BellRing, RefreshCw, ShieldAlert, MonitorX } from "lucide-react";
import type { ReminderHealth } from "@/types";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProvider";
import { Badge } from "@/components/ui/primitives";

export const HEALTH_META: Record<
  ReminderHealth,
  { label: string; tone: "green" | "danger" | "amber" | "plum" | "neutral"; icon: typeof BellRing; dot: string; body: string }
> = {
  enabled: {
    label: "Notifications enabled",
    tone: "green",
    icon: BellRing,
    dot: "bg-green",
    body: "Your reminders are booked with the system and confirmed.",
  },
  disabled: {
    label: "Notifications disabled",
    tone: "danger",
    icon: BellOff,
    dot: "bg-danger",
    body: "Notifications are blocked for BirthdayBook. Turn them on in system settings.",
  },
  "permission-required": {
    label: "Permission required",
    tone: "amber",
    icon: ShieldAlert,
    dot: "bg-coral",
    body: "Allow notifications so reminders can reach you.",
  },
  "needs-refresh": {
    label: "Schedule needs refreshing",
    tone: "plum",
    icon: RefreshCw,
    dot: "bg-coral",
    body: "Something changed since reminders were last booked. Refresh to resync.",
  },
  unsupported: {
    label: "Not supported here",
    tone: "neutral",
    icon: MonitorX,
    dot: "bg-ink-faint",
    body: "This browser can't show notifications. Use the calendar export or the mobile app.",
  },
};

export function HealthBadge({ health }: { health?: ReminderHealth }) {
  const app = useApp();
  const h = health ?? app.health;
  const m = HEALTH_META[h];
  return (
    <Badge tone={m.tone} icon={m.icon}>
      {m.label}
    </Badge>
  );
}

export function HealthDot({ className }: { className?: string }) {
  const { health, ready } = useApp();
  if (!ready || health === "enabled") return null;
  return (
    <span className={cn("block size-2.5 rounded-full ring-2 ring-surface", HEALTH_META[health].dot, className)}>
      <span className="sr-only">{HEALTH_META[health].label}</span>
    </span>
  );
}
