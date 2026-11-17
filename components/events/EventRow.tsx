"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Cake, Check, Gift, Heart, Sparkles, Star } from "lucide-react";
import type { CelebrationEvent } from "@/types";
import { Avatar, Badge } from "@/components/ui/primitives";
import { countdownLabel } from "@/services/calendar/events";
import { daysUntil } from "@/services/birthday/dates";
import { useApp } from "@/components/providers/AppProvider";
import { wishFor } from "@/services/birthday/insights";
import { cn } from "@/lib/utils";

export function eventHref(ev: CelebrationEvent) {
  return ev.kind === "person" ? `/person/?id=${ev.targetId}` : `/occasions/?focus=${ev.targetId}`;
}

export function DateTile({ date, highlight }: { date: Date; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "flex w-12 shrink-0 flex-col items-center justify-center rounded-xl border py-1.5",
        highlight ? "border-coral bg-coral text-[#29252B]" : "border-line bg-surface-2 text-ink",
      )}
      aria-hidden
    >
      <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">{format(date, "MMM")}</span>
      <span className="font-display text-xl leading-none font-semibold">{format(date, "d")}</span>
    </div>
  );
}

export function EventRow({ ev, now = new Date(), onClick, compact }: { ev: CelebrationEvent; now?: Date; onClick?: () => void; compact?: boolean }) {
  const { data } = useApp();
  const person = ev.kind === "person" ? data.people.find((p) => p.id === ev.targetId) : undefined;
  const wish = wishFor(data, ev);
  const days = daysUntil(ev.date, now);
  const giftCount = person ? data.gifts.filter((g) => g.personId === person.id && g.year === ev.year).length : 0;
  const Icon = ev.type === "birthday" ? Cake : Heart;

  const inner = (
    <>
      {person ? <Avatar person={person} size={compact ? 40 : 46} /> : (
        <span className="grid size-[46px] shrink-0 place-items-center rounded-full bg-coral-soft text-coral-ink">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-semibold text-ink">{ev.title}</p>
          {person?.favorite && <Star className="size-3.5 shrink-0 fill-coral text-coral" aria-label="Close circle" />}
        </div>
        <p className="truncate text-sm text-ink-muted">
          {ev.subtitle}
          {ev.shiftedFromLeapDay && " · leap-day birthday"}
          {!compact && ` · ${format(ev.date, "EEE d MMM")}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("text-sm font-semibold tabular-nums", days === 0 ? "text-coral-ink" : days <= 7 ? "text-plum" : "text-ink-muted")}>
          {countdownLabel(ev.date, now)}
        </span>
        <div className="flex gap-1">
          {ev.isMilestone && <Badge tone="amber" icon={Sparkles}>Milestone</Badge>}
          {wish && (wish.status === "sent" || wish.status === "belated") && <Badge tone="green" icon={Check}>Wished</Badge>}
          {!compact && giftCount > 0 && <Badge tone="plum" icon={Gift}>{giftCount}</Badge>}
        </div>
      </div>
    </>
  );

  const cls = "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 min-h-14";
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return (
    <Link href={eventHref(ev)} className={cls}>
      {inner}
    </Link>
  );
}
