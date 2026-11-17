"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { BellRing, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { OccasionForm } from "@/components/occasions/OccasionForm";
import { ReminderEditor } from "@/components/reminders/ReminderEditor";
import { useQueryParams } from "@/hooks/useQueryParams";
import { countdownLabel, nextEventFor } from "@/services/calendar/events";
import { OCCASION_TYPE_LABEL } from "@/lib/labels";
import { fullName, cn } from "@/lib/utils";
import type { Occasion } from "@/types";

export default function OccasionsPage() {
  const { ready, data, repo, toast } = useApp();
  const params = useQueryParams();
  const [editing, setEditing] = useState<Occasion | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Occasion | null>(null);

  useEffect(() => {
    const f = params?.get("focus");
    if (f) {
      setExpanded(f);
      setTimeout(() => document.getElementById(`occ-${f}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    }
  }, [params]);

  const rows = useMemo(
    () =>
      data.occasions
        .map((o) => ({ o, next: nextEventFor(data, "occasion", o.id) }))
        .sort((a, b) => (a.next?.date.getTime() ?? Infinity) - (b.next?.date.getTime() ?? Infinity)),
    [data],
  );

  if (!ready) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Occasions"
        title="Anniversaries & occasions"
        description="Weddings, work anniversaries, graduations and days you want to remember."
        actions={
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            New occasion
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Heart} title="No occasions yet" body="Add an anniversary or any yearly date that isn't a birthday." action={<Button icon={Plus} onClick={() => setFormOpen(true)}>New occasion</Button>} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map(({ o, next }) => {
            const open = expanded === o.id;
            const people = o.personIds.map((id) => data.people.find((p) => p.id === id)).filter(Boolean);
            return (
              <Card as="li" key={o.id} id={`occ-${o.id}`} className={cn("p-5", open && "ring-2 ring-plum/30 md:col-span-2")}>
                <div className="flex items-start gap-4">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-coral-soft py-2 text-coral-ink">
                    <span className="text-[10px] font-semibold tracking-wider uppercase">{format(new Date(2000, o.month - 1, o.day), "MMM")}</span>
                    <span className="font-display text-2xl leading-none font-semibold">{o.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-ink">{o.title}</p>
                    <p className="text-sm text-ink-muted">
                      {next ? `${next.subtitle} · ${countdownLabel(next.date)}` : `${OCCASION_TYPE_LABEL[o.type]} · past`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="coral">{OCCASION_TYPE_LABEL[o.type]}</Badge>
                      {!o.recurring && <Badge>One-off</Badge>}
                      {next?.isMilestone && <Badge tone="amber">Milestone</Badge>}
                      {people.map((p) => (
                        <Badge key={p!.id} tone="plum">
                          {fullName(p!)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="soft" icon={BellRing} onClick={() => setExpanded(open ? null : o.id)} aria-expanded={open}>
                    Reminders
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => {
                      setEditing(o);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(o)}>
                    Delete
                  </Button>
                </div>
                {open && (
                  <div className="mt-4">
                    <ReminderEditor targetKind="occasion" targetId={o.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </ul>
      )}
      <OccasionForm open={formOpen} onClose={() => setFormOpen(false)} occasion={editing} />
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        danger
        title="Delete occasion?"
        confirmLabel="Delete"
        body={`"${deleting?.title}" and its reminders will be removed from this device.`}
        onConfirm={async () => {
          if (!deleting) return;
          await repo.deleteOccasion(deleting.id);
          toast({ tone: "info", title: "Occasion deleted" });
        }}
      />
    </div>
  );
}
