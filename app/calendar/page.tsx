"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, Grid3x3, List, Plus, Sun } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, PageHeader, Segmented, Select, Spinner } from "@/components/ui/primitives";
import { AgendaView, DayView, MonthView, WeekView, YearView, type CalendarView } from "@/components/calendar/CalendarViews";
import { EventSheet } from "@/components/events/EventSheet";
import { EventRow } from "@/components/events/EventRow";
import { PersonForm } from "@/components/people/PersonForm";
import { eventsInRange, groupByDay } from "@/services/calendar/events";
import { buildIcs } from "@/services/calendar/ics";
import { saveFile } from "@/services/backup/files";
import { exportFileName } from "@/services/excel/workbook";
import { useQueryParams, setQueryParam } from "@/hooks/useQueryParams";
import type { CelebrationEvent, Relationship } from "@/types";
import { RELATIONSHIPS } from "@/types";
import { RELATIONSHIP_LABEL } from "@/lib/labels";

const VIEWS: Array<{ value: CalendarView; label: string; icon: typeof CalendarDays }> = [
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "day", label: "Day", icon: Sun },
  { value: "agenda", label: "Agenda", icon: List },
  { value: "year", label: "Year", icon: Grid3x3 },
];

export default function CalendarPage() {
  const { ready, data, toast } = useApp();
  const params = useQueryParams();
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [open, setOpen] = useState<CelebrationEvent | null>(null);
  const [kind, setKind] = useState<"all" | "birthday" | "occasion">("all");
  const [rel, setRel] = useState<"all" | Relationship>("all");
  const [adding, setAdding] = useState(false);
  const [dir, setDir] = useState(0);
  const ws = data.preferences.weekStartsOn;

  useEffect(() => {
    const v = params?.get("view") as CalendarView | null;
    if (v && VIEWS.some((x) => x.value === v)) setView(v);
  }, [params]);

  const range = useMemo(() => {
    switch (view) {
      case "week":
        return [startOfWeek(cursor, { weekStartsOn: ws }), endOfWeek(cursor, { weekStartsOn: ws })];
      case "day":
        return [cursor, cursor];
      case "agenda":
        return [new Date(), addDays(new Date(), 365)];
      case "year":
        return [startOfYear(cursor), endOfYear(cursor)];
      default:
        return [startOfWeek(startOfMonth(cursor), { weekStartsOn: ws }), endOfWeek(endOfMonth(cursor), { weekStartsOn: ws })];
    }
  }, [view, cursor, ws]);

  const list = useMemo(() => {
    const relOk = (ev: CelebrationEvent) => {
      if (rel === "all") return true;
      return ev.personIds.some((id) => data.people.find((p) => p.id === id)?.relationship === rel);
    };
    return eventsInRange(data, range[0], range[1]).filter(
      (ev) => (kind === "all" || (kind === "birthday" ? ev.type === "birthday" : ev.type !== "birthday")) && relOk(ev),
    );
  }, [data, range, kind, rel]);
  const byDay = useMemo(() => groupByDay(list), [list]);

  function step(n: number) {
    setDir(n);
    setCursor((c) => (view === "week" ? addWeeks(c, n) : view === "day" ? addDays(c, n) : view === "year" ? addYears(c, n) : addMonths(c, n)));
    if (view === "day") setSelected((s) => addDays(s, n));
  }

  function changeView(v: CalendarView) {
    setView(v);
    setQueryParam("view", v === "month" ? null : v);
  }

  function onDrag(_: unknown, info: PanInfo) {
    if (Math.abs(info.offset.x) > 70 && Math.abs(info.velocity.x) > 150) step(info.offset.x < 0 ? 1 : -1);
  }

  const title =
    view === "year"
      ? format(cursor, "yyyy")
      : view === "day"
        ? format(cursor, "d MMMM yyyy")
        : view === "week"
          ? `${format(range[0], "d MMM")} – ${format(range[1], "d MMM yyyy")}`
          : view === "agenda"
            ? "Next 12 months"
            : format(cursor, "MMMM yyyy");

  const selectedEvents = byDay.get(`${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`) ?? [];

  if (!ready) return <Spinner />;

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title={title}
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={async () => {
                const res = await saveFile(buildIcs(data), exportFileName("ics"), "text/calendar");
                if (res.method !== "cancelled") toast({ tone: "success", title: "Calendar file ready", body: "Open it with Google Calendar, Apple Calendar or Outlook." });
              }}
            >
              <span className="hidden sm:inline">Export .ics</span>
              <span className="sm:hidden">.ics</span>
            </Button>
            <Button icon={Plus} onClick={() => setAdding(true)}>
              Add
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <Segmented label="Calendar view" value={view} onChange={changeView} options={VIEWS} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Filter by type" className="h-10 w-auto" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">Everything</option>
            <option value="birthday">Birthdays</option>
            <option value="occasion">Occasions</option>
          </Select>
          <Select aria-label="Filter by relationship" className="h-10 w-auto" value={rel} onChange={(e) => setRel(e.target.value as typeof rel)}>
            <option value="all">All people</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABEL[r]}
              </option>
            ))}
          </Select>
          {view !== "agenda" && (
            <div className="ml-auto flex items-center gap-1 lg:ml-2">
              <Button size="icon" variant="secondary" aria-label="Previous" onClick={() => step(-1)}>
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCursor(new Date());
                  setSelected(new Date());
                }}
              >
                Today
              </Button>
              <Button size="icon" variant="secondary" aria-label="Next" onClick={() => step(1)}>
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={`${view}-${title}`}
          custom={dir}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          drag={view === "month" || view === "week" || view === "day" ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={onDrag}
        >
          {view === "month" && (
            <div className="grid gap-5 2xl:grid-cols-[1fr_20rem]">
              <MonthView
                cursor={cursor}
                events={byDay}
                selected={selected}
                weekStartsOn={ws}
                onSelectDay={(d) => {
                  setSelected(d);
                  if (d.getMonth() !== cursor.getMonth()) setCursor(d);
                }}
                onOpenEvent={setOpen}
              />
              <aside aria-live="polite" className="rounded-[1.25rem] border border-line bg-surface p-4">
                <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{isSameDay(selected, new Date()) ? "Today" : format(selected, "EEEE")}</p>
                <p className="font-display text-2xl font-semibold text-ink">{format(selected, "d MMMM")}</p>
                {selectedEvents.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">Nothing on this day.</p>
                ) : (
                  <ul className="-mx-2 mt-2">
                    {selectedEvents.map((ev) => (
                      <li key={ev.key}>
                        <EventRow ev={ev} compact onClick={() => setOpen(ev)} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 hidden text-xs text-ink-faint sm:block">Tip: use arrow keys to move between days.</p>
              </aside>
            </div>
          )}
          {view === "week" && <WeekView cursor={cursor} events={byDay} onOpenEvent={setOpen} weekStartsOn={ws} />}
          {view === "day" && <DayView cursor={cursor} events={byDay} onOpenEvent={setOpen} />}
          {view === "agenda" && <AgendaView list={list} onOpenEvent={setOpen} />}
          {view === "year" && (
            <YearView
              year={cursor.getFullYear()}
              events={byDay}
              weekStartsOn={ws}
              onPickMonth={(m) => {
                setCursor(new Date(cursor.getFullYear(), m, 1));
                changeView("month");
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <EventSheet ev={open} onClose={() => setOpen(null)} />
      <PersonForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
