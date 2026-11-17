"use client";

import { useEffect, useState } from "react";
import type { Occasion, OccasionType } from "@/types";
import { OCCASION_TYPES } from "@/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { MONTHS, OCCASION_TYPE_LABEL } from "@/lib/labels";
import { isValidDate } from "@/services/birthday/dates";
import { useApp } from "@/components/providers/AppProvider";
import { fullName } from "@/lib/utils";

export function OccasionForm({
  open,
  onClose,
  occasion,
  presetPersonId,
}: {
  open: boolean;
  onClose: () => void;
  occasion?: Occasion;
  presetPersonId?: string;
}) {
  const { repo, data, toast } = useApp();
  const [type, setType] = useState<OccasionType>("anniversary");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [notes, setNotes] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setType(occasion?.type ?? "anniversary");
    setTitle(occasion?.title ?? "");
    setDay(occasion ? String(occasion.day) : "");
    setMonth(occasion ? String(occasion.month) : "");
    setYear(occasion?.year ? String(occasion.year) : "");
    setRecurring(occasion?.recurring ?? true);
    setNotes(occasion?.notes ?? "");
    setPeople(occasion?.personIds ?? (presetPersonId ? [presetPersonId] : []));
    setErr(undefined);
  }, [open, occasion, presetPersonId]);

  async function save() {
    const d = Number(day);
    const m = Number(month);
    const y = year ? Number(year) : undefined;
    if (!title.trim()) return setErr("Give the occasion a title");
    if (!d || !m || !isValidDate(y, m, d)) return setErr("Enter a valid date");
    if (!recurring && !y) return setErr("A one-off occasion needs a year");
    const payload = { type, title: title.trim(), month: m, day: d, year: y, recurring, notes: notes.trim() || undefined, personIds: people };
    if (occasion) await repo.upsert("occasions", { ...occasion, ...payload });
    else await repo.addOccasion(payload);
    toast({ tone: "success", title: occasion ? "Occasion updated" : "Occasion added" });
    onClose();
  }

  const sortedPeople = [...data.people].sort((a, b) => fullName(a).localeCompare(fullName(b)));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={occasion ? "Edit occasion" : "New occasion"}
      description="Anniversaries, work milestones, graduations, remembrance days."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{occasion ? "Save" : "Add occasion"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="of-type">
          <Select id="of-type" value={type} onChange={(e) => setType(e.target.value as OccasionType)}>
            {OCCASION_TYPES.map((t) => (
              <option key={t} value={t}>
                {OCCASION_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="of-title">
          <Input id="of-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Priya & Arjun's wedding" />
        </Field>
        <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-3 sm:col-span-2">
          <Field label="Day" htmlFor="of-day">
            <Input id="of-day" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </Field>
          <Field label="Month" htmlFor="of-month">
            <Select id="of-month" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map((mm, i) => (
                <option key={mm} value={i + 1}>
                  {mm}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year" htmlFor="of-year" hint="Shows how many years">
            <Input id="of-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          </Field>
        </div>
        {err && (
          <p className="text-sm text-danger sm:col-span-2" role="alert">
            {err}
          </p>
        )}
        <div className="sm:col-span-2">
          <Switch checked={recurring} onChange={setRecurring} label="Repeats every year" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-ink">People involved</legend>
          {sortedPeople.length === 0 ? (
            <p className="text-sm text-ink-muted">Add people first to link them here.</p>
          ) : (
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {sortedPeople.map((p) => {
                const on = people.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPeople((xs) => (on ? xs.filter((x) => x !== p.id) : [...xs, p.id]))}
                    className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${on ? "border-plum bg-plum-soft text-plum" : "border-line-strong text-ink-muted hover:text-ink"}`}
                  >
                    {fullName(p)}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
        <Field label="Notes" htmlFor="of-notes" className="sm:col-span-2">
          <Textarea id="of-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
    </Sheet>
  );
}
