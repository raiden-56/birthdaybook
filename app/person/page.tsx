"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Archive,
  ArrowLeft,
  BellRing,
  BookHeart,
  Cake,
  Check,
  ClipboardCheck,
  Gift,
  Heart,
  Mail,
  MessageCircleHeart,
  Palette,
  Pencil,
  Phone,
  Pin,
  Plus,
  Sparkles,
  Star,
  Trash2,
  UserX,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, Input, Select, Spinner, Textarea } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { PersonForm } from "@/components/people/PersonForm";
import { OccasionForm } from "@/components/occasions/OccasionForm";
import { ReminderEditor } from "@/components/reminders/ReminderEditor";
import { GiftEditor } from "@/components/gifts/GiftEditor";
import { useQueryParams } from "@/hooks/useQueryParams";
import { fullName, cn } from "@/lib/utils";
import { NOTE_KIND_LABEL, RELATIONSHIP_LABEL, WISH_CHANNEL_LABEL, WISH_STATUS_LABEL } from "@/lib/labels";
import { countdownLabel, nextEventFor } from "@/services/calendar/events";
import { currentAge, zodiacSign } from "@/services/birthday/dates";
import { DEFAULT_CHECKLIST } from "@/services/greeting-cards/messages";
import { NOTE_KINDS, type NoteKind } from "@/types";

export default function PersonPage() {
  const params = useQueryParams();
  const id = params?.get("id") ?? "";
  const router = useRouter();
  const { ready, data, repo, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOccasion, setAddOccasion] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("memory");
  const [checkText, setCheckText] = useState("");

  const person = data.people.find((p) => p.id === id);
  const next = useMemo(() => (person ? nextEventFor(data, "person", person.id) : undefined), [data, person]);

  useEffect(() => {
    if (person && next) void repo.ensureChecklist("person", person.id, next.year, DEFAULT_CHECKLIST);
  }, [person, next, repo]);

  if (!ready || !params) return <Spinner />;
  if (!person || !next)
    return (
      <EmptyState
        icon={UserX}
        title="Person not found"
        body="They may have been deleted."
        action={
          <ButtonLink href="/people/" variant="primary">
            Back to people
          </ButtonLink>
        }
      />
    );

  const age = currentAge(person.birthYear, person.birthMonth, person.birthDay, new Date(), person.leapPolicy ?? data.preferences.leapPolicy);
  const notes = data.notes.filter((n) => n.personId === person.id).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date));
  const wishes = data.wishes.filter((w) => w.targetKind === "person" && w.targetId === person.id).sort((a, b) => b.year - a.year);
  const checklist = data.checklist.filter((c) => c.targetKind === "person" && c.targetId === person.id && c.year === next.year).sort((a, b) => a.order - b.order);
  const occasions = data.occasions.filter((o) => o.personIds.includes(person.id));

  return (
    <div className="space-y-6">
      <Link href="/people/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> People
      </Link>

      {/* Header */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <Avatar person={person} size={84} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{fullName(person)}</h1>
              {person.favorite && <Star className="size-5 fill-coral text-coral" aria-label="Close circle" />}
            </div>
            <p className="mt-1 text-ink-muted">
              {person.nickname && <>“{person.nickname}” · </>}
              {RELATIONSHIP_LABEL[person.relationship]} · Born {format(new Date(2000, person.birthMonth - 1, person.birthDay), "d MMMM")}
              {person.birthYear ? ` ${person.birthYear}` : ""}
              {age != null && ` · ${age} years old`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="plum" icon={Cake}>
                {countdownLabel(next.date)} · {format(next.date, "EEE d MMM yyyy")}
              </Badge>
              {next.turning && <Badge tone={next.isMilestone ? "amber" : "neutral"} icon={next.isMilestone ? Sparkles : undefined}>Turns {next.turning}</Badge>}
              <Badge>{zodiacSign(person.birthMonth, person.birthDay)}</Badge>
              {next.shiftedFromLeapDay && <Badge tone="coral">Observed {format(next.date, "d MMM")} (leap day)</Badge>}
              {person.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {person.phone ? (
            <a href={`tel:${person.phone}`} className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm font-medium text-ink hover:bg-surface-2">
              <Phone className="size-4 text-plum" aria-hidden /> Call
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm text-ink-faint">
              <Phone className="size-4" aria-hidden /> No phone
            </span>
          )}
          {person.email ? (
            <a href={`mailto:${person.email}`} className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm font-medium text-ink hover:bg-surface-2">
              <Mail className="size-4 text-plum" aria-hidden /> Email
            </a>
          ) : (
            <span className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm text-ink-faint">
              <Mail className="size-4" aria-hidden /> No email
            </span>
          )}
          <Link href={`/messages/?target=person:${person.id}`} className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm font-medium text-ink hover:bg-surface-2">
            <MessageCircleHeart className="size-4 text-plum" aria-hidden /> Message
          </Link>
          <Link href={`/cards/?target=person:${person.id}`} className="flex min-h-14 items-center justify-center gap-2 bg-surface text-sm font-medium text-ink hover:bg-surface-2">
            <Palette className="size-4 text-plum" aria-hidden /> Card
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reminders */}
        <Card>
          <CardHeader title="Reminders" description="Each one becomes a phone notification" icon={BellRing} />
          <div className="px-5 pb-5">
            <ReminderEditor targetKind="person" targetId={person.id} />
          </div>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader title={`Checklist for ${next.year}`} description="Get ready before the day" icon={ClipboardCheck} />
          <ul className="px-3 pb-2">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2">
                <button
                  role="checkbox"
                  aria-checked={c.done}
                  onClick={() => repo.upsert("checklist", { ...c, done: !c.done })}
                  className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                >
                  <span className={cn("grid size-6 place-items-center rounded-md border-2", c.done ? "border-green bg-green text-white" : "border-line-strong")}>
                    {c.done && <Check className="size-4" aria-hidden />}
                  </span>
                  <span className={cn("text-[15px]", c.done ? "text-ink-faint line-through" : "text-ink")}>{c.text}</span>
                </button>
                <Button size="icon" variant="ghost" aria-label={`Remove ${c.text}`} className="size-10 opacity-60 hover:opacity-100" onClick={() => repo.remove("checklist", c.id)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2 px-5 pb-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!checkText.trim()) return;
              await repo.upsert("checklist", {
                id: `c_${Date.now().toString(36)}`,
                targetKind: "person",
                targetId: person.id,
                year: next.year,
                text: checkText.trim(),
                done: false,
                order: checklist.length,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              setCheckText("");
            }}
          >
            <Input aria-label="New checklist item" placeholder="Add a task…" value={checkText} onChange={(e) => setCheckText(e.target.value)} />
            <Button type="submit" variant="soft" size="icon" aria-label="Add task">
              <Plus className="size-5" aria-hidden />
            </Button>
          </form>
        </Card>

        {/* Gifts */}
        <Card id="gifts">
          <CardHeader title="Gifts" description="Ideas, purchases and what you've given before" icon={Gift} />
          <div className="px-5 pb-5">
            <GiftEditor personId={person.id} year={next.year} />
          </div>
        </Card>

        {/* Relationship memory */}
        <Card>
          <CardHeader title="Relationship memory" description="Things worth remembering about them" icon={BookHeart} />
          <div className="px-5 pb-5">
            {person.summary && <p className="mb-4 rounded-xl bg-surface-2 p-3 text-[15px] text-ink">{person.summary}</p>}
            <form
              className="mb-4 space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!noteText.trim()) return;
                await repo.addNote({ personId: person.id, kind: noteKind, text: noteText.trim(), date: format(new Date(), "yyyy-MM-dd") });
                setNoteText("");
              }}
            >
              <Textarea aria-label="New note" placeholder="They mentioned wanting to learn pottery…" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <div className="flex gap-2">
                <Select aria-label="Note type" value={noteKind} onChange={(e) => setNoteKind(e.target.value as NoteKind)} className="h-10">
                  {NOTE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {NOTE_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="soft" disabled={!noteText.trim()}>
                  Save note
                </Button>
              </div>
            </form>
            {notes.length === 0 ? (
              <p className="text-sm text-ink-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-line p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge tone={n.kind === "preference" ? "coral" : n.kind === "memory" ? "plum" : "neutral"}>{NOTE_KIND_LABEL[n.kind]}</Badge>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-ink-faint">{format(new Date(`${n.date}T00:00`), "d MMM yyyy")}</span>
                        <Button size="icon" variant="ghost" className="size-9" aria-label={n.pinned ? "Unpin" : "Pin"} aria-pressed={!!n.pinned} onClick={() => repo.upsert("notes", { ...n, pinned: !n.pinned })}>
                          <Pin className={cn("size-4", n.pinned && "fill-current text-plum")} aria-hidden />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-9" aria-label="Delete note" onClick={() => repo.remove("notes", n.id)}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    <p className="text-[15px] whitespace-pre-wrap text-ink">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Wish history */}
        <Card>
          <CardHeader title="Wish history" description="Did you wish them each year?" icon={Heart} />
          <div className="px-5 pb-5">
            {wishes.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing recorded yet. Mark a wish from the calendar or a notification.</p>
            ) : (
              <ul className="divide-y divide-line">
                {wishes.map((w) => (
                  <li key={w.id} className="flex min-h-11 items-center justify-between gap-2 py-1.5">
                    <span className="font-display text-lg font-semibold text-ink">{w.year}</span>
                    <span className="flex items-center gap-2 text-sm text-ink-muted">
                      {w.channel && WISH_CHANNEL_LABEL[w.channel]}
                      <Badge tone={w.status === "sent" ? "green" : w.status === "belated" ? "amber" : w.status === "skipped" ? "danger" : "neutral"}>{WISH_STATUS_LABEL[w.status]}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Occasions */}
        <Card>
          <CardHeader
            title="Shared occasions"
            description="Anniversaries and milestones"
            icon={Sparkles}
            action={
              <Button size="sm" variant="soft" icon={Plus} onClick={() => setAddOccasion(true)}>
                Add
              </Button>
            }
          />
          <div className="px-5 pb-5">
            {occasions.length === 0 ? (
              <p className="text-sm text-ink-muted">None linked.</p>
            ) : (
              <ul className="space-y-1">
                {occasions.map((o) => {
                  const ev = nextEventFor(data, "occasion", o.id);
                  return (
                    <li key={o.id}>
                      <Link href={`/occasions/?focus=${o.id}`} className="flex min-h-11 items-center justify-between rounded-xl px-2 hover:bg-surface-2">
                        <span className="text-[15px] text-ink">{o.title}</span>
                        <span className="text-sm text-ink-muted">{ev ? `${ev.subtitle} · ${countdownLabel(ev.date)}` : "Past"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <Button
          variant="secondary"
          icon={Archive}
          onClick={async () => {
            await repo.updatePerson({ ...person, archived: !person.archived });
            toast({ tone: "info", title: person.archived ? "Restored" : "Archived", body: person.archived ? undefined : "No more reminders for them. Find them under People › archived." });
          }}
        >
          {person.archived ? "Unarchive" : "Archive"}
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <PersonForm open={editing} onClose={() => setEditing(false)} person={person} />
      <OccasionForm open={addOccasion} onClose={() => setAddOccasion(false)} presetPersonId={person.id} />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title={`Delete ${person.firstName}?`}
        confirmLabel="Delete"
        body={
          <>
            This removes {fullName(person)} with their reminders, gifts, notes and wish history from this device. A safety snapshot is saved first, so you can undo it
            from Excel &amp; Backup. Archiving keeps everything and just stops reminders.
          </>
        }
        onConfirm={async () => {
          await repo.createSnapshot(`Before deleting ${fullName(person)}`);
          await repo.deletePerson(person.id);
          toast({ tone: "info", title: `${person.firstName} deleted` });
          router.push("/people/");
        }}
      />
    </div>
  );
}
