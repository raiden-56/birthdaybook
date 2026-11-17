"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Check, MessageCircleHeart, Palette, Phone, UserRound, Gift, X } from "lucide-react";
import type { CelebrationEvent, WishChannel } from "@/types";
import { WISH_CHANNELS } from "@/types";
import { Sheet } from "@/components/ui/Sheet";
import { Badge, ButtonLink, Button } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/AppProvider";
import { countdownLabel } from "@/services/calendar/events";
import { wishFor } from "@/services/birthday/insights";
import { WISH_CHANNEL_LABEL, WISH_STATUS_LABEL } from "@/lib/labels";
import { daysUntil } from "@/services/birthday/dates";
import { eventHref } from "./EventRow";

export function EventSheet({ ev, onClose }: { ev: CelebrationEvent | null; onClose: () => void }) {
  const { data, repo, toast } = useApp();
  if (!ev) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const person = ev.kind === "person" ? data.people.find((p) => p.id === ev.targetId) : undefined;
  const wish = wishFor(data, ev);
  const past = daysUntil(ev.date) < 0;
  const gifts = person ? data.gifts.filter((g) => g.personId === person.id && g.year === ev.year) : [];

  async function markWished(channel: WishChannel) {
    await repo.setWish(ev!.kind, ev!.targetId, ev!.year, {
      status: past ? "belated" : "sent",
      channel,
      sentAt: new Date().toISOString(),
    });
    toast({ tone: "success", title: "Marked as wished", body: `${WISH_CHANNEL_LABEL[channel]} · ${ev!.title}` });
  }

  return (
    <Sheet
      open={!!ev}
      onClose={onClose}
      title={ev.title}
      description={`${ev.subtitle} · ${format(ev.date, "EEEE d MMMM yyyy")} · ${countdownLabel(ev.date)}`}
      footer={
        <ButtonLink href={eventHref(ev)} variant="primary" icon={UserRound} onClick={onClose}>
          {person ? "Open profile" : "Open occasion"}
        </ButtonLink>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {ev.isMilestone && <Badge tone="amber">Milestone</Badge>}
          {ev.shiftedFromLeapDay && <Badge tone="plum">Observed date for 29 Feb</Badge>}
          <Badge tone={wish && wish.status !== "pending" ? "green" : "neutral"}>{WISH_STATUS_LABEL[wish?.status ?? "pending"]}</Badge>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Wish tracker</h3>
          <div className="flex flex-wrap gap-2">
            {WISH_CHANNELS.slice(0, 5).map((c) => (
              <Button key={c} size="sm" variant={wish?.channel === c ? "soft" : "secondary"} icon={wish?.channel === c ? Check : undefined} onClick={() => markWished(c)}>
                {WISH_CHANNEL_LABEL[c]}
              </Button>
            ))}
            {wish && wish.status !== "pending" && (
              <Button size="sm" variant="ghost" icon={X} onClick={() => repo.setWish(ev.kind, ev.targetId, ev.year, { status: "pending", channel: undefined, sentAt: undefined })}>
                Undo
              </Button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickLink href={`/messages/?target=${ev.kind}:${ev.targetId}`} icon={MessageCircleHeart} label="Write message" onClick={onClose} />
          <QuickLink href={`/cards/?target=${ev.kind}:${ev.targetId}`} icon={Palette} label="Make a card" onClick={onClose} />
          {person && <QuickLink href={`/person/?id=${person.id}#gifts`} icon={Gift} label={gifts.length ? `${gifts.length} gift${gifts.length > 1 ? "s" : ""}` : "Plan a gift"} onClick={onClose} />}
          {person?.phone && <QuickLink href={`tel:${person.phone}`} icon={Phone} label="Call" />}
        </section>
      </div>
    </Sheet>
  );
}

function QuickLink({ href, icon: Icon, label, onClick }: { href: string; icon: typeof Gift; label: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface-2 p-3 text-center text-sm font-medium text-ink hover:border-plum/40">
      <Icon className="size-5 text-plum" aria-hidden />
      {label}
    </Link>
  );
}
