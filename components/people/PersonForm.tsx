"use client";

import { useEffect, useState } from "react";
import type { LeapPolicy, Person, Relationship } from "@/types";
import { RELATIONSHIPS } from "@/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button, Field, Input, Select, Switch, Textarea } from "@/components/ui/primitives";
import { RELATIONSHIP_LABEL, MONTHS } from "@/lib/labels";
import { isValidDate } from "@/services/birthday/dates";
import { useApp } from "@/components/providers/AppProvider";
import { offsetLabel } from "@/services/reminders/planner";

type Draft = {
  firstName: string;
  lastName: string;
  nickname: string;
  relationship: Relationship;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  phone: string;
  email: string;
  address: string;
  tags: string;
  favorite: boolean;
  summary: string;
  leapPolicy: "" | LeapPolicy;
};

const blank: Draft = {
  firstName: "",
  lastName: "",
  nickname: "",
  relationship: "friend",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  phone: "",
  email: "",
  address: "",
  tags: "",
  favorite: false,
  summary: "",
  leapPolicy: "",
};

function toDraft(p?: Person): Draft {
  if (!p) return blank;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    nickname: p.nickname ?? "",
    relationship: p.relationship,
    birthDay: String(p.birthDay),
    birthMonth: String(p.birthMonth),
    birthYear: p.birthYear ? String(p.birthYear) : "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    tags: p.tags.join(", "),
    favorite: p.favorite,
    summary: p.summary ?? "",
    leapPolicy: p.leapPolicy ?? "",
  };
}

export function PersonForm({
  open,
  onClose,
  person,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  person?: Person;
  onSaved?: (p: Person) => void;
}) {
  const { repo, toast, data } = useApp();
  const [d, setD] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);
  const [withReminders, setWithReminders] = useState(true);

  useEffect(() => {
    if (open) {
      setD(toDraft(person));
      setErrors({});
    }
  }, [open, person]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  function validate(): boolean {
    const e: typeof errors = {};
    if (!d.firstName.trim()) e.firstName = "Enter a first name";
    const day = Number(d.birthDay);
    const month = Number(d.birthMonth);
    const year = d.birthYear ? Number(d.birthYear) : undefined;
    if (!month) e.birthMonth = "Choose a month";
    if (!day) e.birthDay = "Enter the day";
    if (year != null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear())) e.birthYear = "Enter a year between 1900 and this year";
    if (day && month && !isValidDate(year, month, day)) e.birthDay = year ? `${MONTHS[month - 1]} ${day}, ${year} doesn't exist` : `${MONTHS[month - 1]} has no day ${day}`;
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = "That email doesn't look right";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    const payload = {
      firstName: d.firstName.trim(),
      lastName: d.lastName.trim(),
      nickname: d.nickname.trim() || undefined,
      relationship: d.relationship,
      birthDay: Number(d.birthDay),
      birthMonth: Number(d.birthMonth),
      birthYear: d.birthYear ? Number(d.birthYear) : undefined,
      phone: d.phone.trim() || undefined,
      email: d.email.trim() || undefined,
      address: d.address.trim() || undefined,
      tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
      favorite: d.favorite,
      summary: d.summary.trim() || undefined,
      leapPolicy: d.leapPolicy || undefined,
    };
    try {
      if (person) {
        const next = { ...person, ...payload };
        await repo.updatePerson(next);
        toast({ tone: "success", title: "Saved", body: `${payload.firstName}'s details are updated.` });
        onSaved?.(next);
      } else {
        const created = await repo.addPerson({ ...payload, archived: false }, { defaultReminders: withReminders });
        toast({ tone: "success", title: `${payload.firstName} added`, body: withReminders ? "Default reminders are on." : undefined });
        onSaved?.(created);
      }
      onClose();
    } catch {
      toast({ tone: "danger", title: "Couldn't save", body: "Storage write failed. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const isLeap = d.birthMonth === "2" && d.birthDay === "29";
  const defaults = data.preferences.defaultOffsets.slice().sort((a, b) => b - a).map(offsetLabel).join(", ");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={person ? `Edit ${person.firstName}` : "Add a person"}
      description={person ? undefined : "Only the name and birthday are required."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {person ? "Save changes" : "Add person"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <Field label="First name" htmlFor="pf-first" error={errors.firstName}>
          <Input id="pf-first" value={d.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" invalid={!!errors.firstName} />
        </Field>
        <Field label="Last name" htmlFor="pf-last">
          <Input id="pf-last" value={d.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
        </Field>

        <fieldset className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-3 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Birthday</legend>
          <Field label="Day" htmlFor="pf-day" error={errors.birthDay}>
            <Input id="pf-day" inputMode="numeric" value={d.birthDay} onChange={(e) => set("birthDay", e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="14" invalid={!!errors.birthDay} />
          </Field>
          <Field label="Month" htmlFor="pf-month" error={errors.birthMonth}>
            <Select id="pf-month" value={d.birthMonth} onChange={(e) => set("birthMonth", e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year (optional)" htmlFor="pf-year" error={errors.birthYear}>
            <Input id="pf-year" inputMode="numeric" value={d.birthYear} onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1990" invalid={!!errors.birthYear} />
          </Field>
        </fieldset>

        {isLeap && (
          <Field label="In non-leap years, celebrate on" htmlFor="pf-leap" className="sm:col-span-2" hint="Leave on default to follow your global setting.">
            <Select id="pf-leap" value={d.leapPolicy} onChange={(e) => set("leapPolicy", e.target.value as Draft["leapPolicy"])}>
              <option value="">Default ({data.preferences.leapPolicy === "mar1" ? "1 March" : "28 February"})</option>
              <option value="feb28">28 February</option>
              <option value="mar1">1 March</option>
            </Select>
          </Field>
        )}

        <Field label="Relationship" htmlFor="pf-rel">
          <Select id="pf-rel" value={d.relationship} onChange={(e) => set("relationship", e.target.value as Relationship)}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nickname" htmlFor="pf-nick">
          <Input id="pf-nick" value={d.nickname} onChange={(e) => set("nickname", e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="pf-phone">
          <Input id="pf-phone" type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
        </Field>
        <Field label="Email" htmlFor="pf-email" error={errors.email}>
          <Input id="pf-email" type="email" value={d.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" invalid={!!errors.email} />
        </Field>
        <Field label="Tags" htmlFor="pf-tags" hint="Comma separated, e.g. college, book club" className="sm:col-span-2">
          <Input id="pf-tags" value={d.tags} onChange={(e) => set("tags", e.target.value)} />
        </Field>
        <Field label="Address" htmlFor="pf-addr" className="sm:col-span-2">
          <Input id="pf-addr" value={d.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
        </Field>
        <Field label="About them" htmlFor="pf-sum" className="sm:col-span-2" hint="Anything worth remembering. Longer memories go in Notes.">
          <Textarea id="pf-sum" value={d.summary} onChange={(e) => set("summary", e.target.value)} rows={3} />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={d.favorite} onChange={(v) => set("favorite", v)} label="Close circle" description="Pinned to the top of lists and the dashboard." />
          {!person && <Switch checked={withReminders} onChange={setWithReminders} label="Add default reminders" description={defaults} />}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
