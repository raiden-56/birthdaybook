"use client";

import { Select } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/AppProvider";
import { fullName } from "@/lib/utils";
import { upcomingEvents } from "@/services/calendar/events";
import { useMemo } from "react";

/** Picks a person or occasion; value format "person:<id>" | "occasion:<id>". */
export function TargetPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const { data } = useApp();
  const soon = useMemo(() => upcomingEvents(data, new Date(), 30), [data]);
  const people = [...data.people].filter((p) => !p.archived).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Who is it for">
      <option value="">Choose someone…</option>
      {soon.length > 0 && (
        <optgroup label="Coming up">
          {soon.map((ev) => (
            <option key={`s-${ev.key}`} value={`${ev.kind}:${ev.targetId}`}>
              {ev.title} — {ev.subtitle}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="People">
        {people.map((p) => (
          <option key={p.id} value={`person:${p.id}`}>
            {fullName(p)}
          </option>
        ))}
      </optgroup>
      {data.occasions.length > 0 && (
        <optgroup label="Occasions">
          {data.occasions.map((o) => (
            <option key={o.id} value={`occasion:${o.id}`}>
              {o.title}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
