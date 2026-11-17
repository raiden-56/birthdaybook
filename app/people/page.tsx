"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Search, Star, UserPlus, Users } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui/primitives";
import { PersonForm } from "@/components/people/PersonForm";
import { RELATIONSHIP_LABEL } from "@/lib/labels";
import { RELATIONSHIPS, type Relationship } from "@/types";
import { fullName } from "@/lib/utils";
import { countdownLabel, nextEventFor } from "@/services/calendar/events";
import { daysUntil } from "@/services/birthday/dates";

type Sort = "upcoming" | "name" | "month";

export default function PeoplePage() {
  const { ready, data } = useApp();
  const [q, setQ] = useState("");
  const [rel, setRel] = useState<"all" | Relationship>("all");
  const [sort, setSort] = useState<Sort>("upcoming");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const now = new Date();
    return data.people
      .filter((p) => (showArchived ? p.archived : !p.archived))
      .filter((p) => rel === "all" || p.relationship === rel)
      .filter((p) => !needle || [fullName(p), p.nickname, p.email, p.phone, ...p.tags].some((v) => v?.toLowerCase().includes(needle)))
      .map((p) => ({ p, next: nextEventFor(data, "person", p.id, now)! }))
      .sort((a, b) => {
        if (a.p.favorite !== b.p.favorite && sort === "upcoming") return a.p.favorite ? -1 : 1;
        if (sort === "name") return fullName(a.p).localeCompare(fullName(b.p));
        if (sort === "month") return a.p.birthMonth - b.p.birthMonth || a.p.birthDay - b.p.birthDay;
        return a.next.date.getTime() - b.next.date.getTime();
      });
  }, [data, q, rel, sort, showArchived]);

  if (!ready) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Your people"
        description={`${data.people.filter((p) => !p.archived).length} people, sorted by whose birthday is next.`}
        actions={
          <Button icon={UserPlus} onClick={() => setAdding(true)}>
            Add person
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label="Search people" placeholder="Search name, tag, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" type="search" />
        </div>
        <div className="flex gap-2">
          <Select aria-label="Relationship" value={rel} onChange={(e) => setRel(e.target.value as typeof rel)} className="sm:w-40">
            <option value="all">Everyone</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="sm:w-40">
            <option value="upcoming">Next birthday</option>
            <option value="name">Name</option>
            <option value="month">Calendar order</option>
          </Select>
        </div>
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q || rel !== "all" ? "No matches" : showArchived ? "No archived people" : "No one here yet"}
            body={q || rel !== "all" ? "Try a different search or filter." : "Add someone or import a spreadsheet from Excel & Backup."}
            action={!q && rel === "all" && !showArchived ? <Button icon={UserPlus} onClick={() => setAdding(true)}>Add person</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map(({ p, next }) => {
              const days = daysUntil(next.date);
              return (
                <li key={p.id}>
                  <Link href={`/person/?id=${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5">
                    <Avatar person={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-ink">{fullName(p)}</p>
                        {p.favorite && <Star className="size-3.5 shrink-0 fill-coral text-coral" aria-label="Close circle" />}
                      </div>
                      <p className="truncate text-sm text-ink-muted">
                        {format(new Date(2000, p.birthMonth - 1, p.birthDay), "d MMMM")}
                        {p.birthYear ? ` ${p.birthYear}` : ""} · {RELATIONSHIP_LABEL[p.relationship]}
                        {p.tags.length ? ` · ${p.tags.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={days <= 7 ? "text-sm font-semibold text-plum" : "text-sm text-ink-muted"}>{countdownLabel(next.date)}</span>
                      {next.turning && <Badge tone={next.isMilestone ? "amber" : "neutral"}>Turns {next.turning}</Badge>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {data.people.some((p) => p.archived) && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "Back to active people" : `Show archived (${data.people.filter((p) => p.archived).length})`}
          </Button>
        </div>
      )}

      <PersonForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
