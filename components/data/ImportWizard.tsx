"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, FileDown, FileUp, RotateCcw, XCircle } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Badge, Button, Field, Select, Switch } from "@/components/ui/primitives";
import { readWorkbook, type ReadResult } from "@/services/excel/workbook";
import { guessMapping, MAPPABLE_FIELDS, type MappableField } from "@/services/excel/schema";
import {
  analyzePeopleSheet,
  applyPeoplePreview,
  errorReportCsv,
  parseBirthdayBookWorkbook,
  previewErrorsCsv,
  type DuplicateStrategy,
} from "@/services/excel/importer";
import { parseBackup, type ParsedBackup } from "@/services/backup/backup";
import { saveFile } from "@/services/backup/files";
import { formatMonthDay } from "@/lib/labels";
import { cn, fullName } from "@/lib/utils";
import type { BirthdayBookData } from "@/types";

type Stage =
  | { kind: "idle" }
  | { kind: "mapping"; wb: ReadResult; sheetIndex: number; mapping: MappableField[] }
  | { kind: "full"; wb: ReadResult; data: Partial<BirthdayBookData>; errors: Array<{ sheet: string; row: number; message: string }> }
  | { kind: "backup"; fileName: string; parsed: ParsedBackup };

const ACCEPT = ".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.json,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function ImportWizard() {
  const { data, repo, toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dateOrder, setDateOrder] = useState(data.preferences.dateOrder);
  const [strategy, setStrategy] = useState<DuplicateStrategy>("skip");
  const [withReminders, setWithReminders] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(undefined);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("That file is over 25 MB. Is it the right one?");
      const buf = await file.arrayBuffer();
      if (/\.json$/i.test(file.name) || file.type === "application/json") {
        setStage({ kind: "backup", fileName: file.name, parsed: parseBackup(new TextDecoder().decode(buf)) });
        return;
      }
      const wb = readWorkbook(buf, file.name);
      if (!wb.sheets.length) throw new Error("No data found in this file.");
      if (wb.isBirthdayBook) {
        const res = parseBirthdayBookWorkbook(wb, dateOrder);
        setStage({ kind: "full", wb, data: res.data, errors: res.errors });
        return;
      }
      // Pick the sheet that looks most like a people list.
      let best = 0;
      let bestScore = -1;
      wb.sheets.forEach((s, i) => {
        const score = guessMapping(s.headers).filter((f) => f !== "ignore").length * 1000 + s.rows.length;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      });
      setStage({ kind: "mapping", wb, sheetIndex: best, mapping: guessMapping(wb.sheets[best].headers) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  const preview = useMemo(() => {
    if (stage.kind !== "mapping") return null;
    const sheet = stage.wb.sheets[stage.sheetIndex];
    return analyzePeopleSheet(sheet, stage.mapping, data.people, dateOrder);
  }, [stage, data.people, dateOrder]);

  const counts = useMemo(() => {
    if (!preview) return null;
    const ok = preview.filter((r) => r.person && !r.errors.length);
    return {
      total: preview.length,
      valid: ok.length,
      errors: preview.filter((r) => r.errors.length).length,
      duplicates: ok.filter((r) => r.duplicateOfId).length,
      warnings: preview.filter((r) => r.warnings.length).length,
    };
  }, [preview]);

  const mappingProblem = useMemo(() => {
    if (stage.kind !== "mapping") return undefined;
    const m = stage.mapping;
    const hasName = m.includes("fullName") || m.includes("firstName");
    const hasDate = m.includes("birthday") || (m.includes("birthDay") && m.includes("birthMonth"));
    if (!hasName) return "Map a column to Full name or First name.";
    if (!hasDate) return "Map a Birthday column, or both Birth day and Birth month.";
    return undefined;
  }, [stage]);

  function reset() {
    setStage({ kind: "idle" });
    if (input.current) input.current.value = "";
  }

  async function commitMapping() {
    if (!preview) return;
    setBusy(true);
    const { add, update, skipped } = applyPeoplePreview(preview, data.people, strategy);
    await repo.importPeople(add, update, withReminders);
    if (dateOrder !== data.preferences.dateOrder) await repo.setPreferences({ dateOrder });
    setBusy(false);
    toast({ tone: "success", title: `Imported ${add.length} new, updated ${update.length}`, body: skipped ? `${skipped} rows skipped. A snapshot was saved first.` : "A snapshot was saved first." });
    reset();
  }

  async function commitFull(mode: "merge" | "replace", payload: Partial<BirthdayBookData>, label: string) {
    setBusy(true);
    if (mode === "replace") {
      await repo.replaceAll({ ...repo.getSnapshot(), ...payload, preferences: { ...repo.getSnapshot().preferences, ...(payload.preferences ?? {}) } } as BirthdayBookData, label);
    } else {
      await repo.mergeAll(payload, label);
    }
    setBusy(false);
    toast({ tone: "success", title: mode === "replace" ? "Data replaced" : "Data merged", body: "A snapshot of your previous data was saved." });
    reset();
  }

  /* ---------- idle ---------- */
  if (stage.kind === "idle")
    return (
      <div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void handleFile(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-plum bg-plum-soft/50" : "border-line-strong hover:border-plum/50 hover:bg-surface-2",
          )}
        >
          <FileUp className="mb-3 size-8 text-plum" aria-hidden />
          <span className="font-semibold text-ink">Choose a file or drop it here</span>
          <span className="mt-1 text-sm text-ink-muted">Excel (.xlsx, .xls), CSV, OpenDocument, or a BirthdayBook .json backup</span>
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </label>
        {error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-danger" role="alert">
            <XCircle className="size-4" aria-hidden /> {error}
          </p>
        )}
        <p className="mt-3 text-xs text-ink-muted">Nothing changes until you confirm the preview. Your original file is never modified.</p>
      </div>
    );

  /* ---------- JSON backup ---------- */
  if (stage.kind === "backup") {
    const p = stage.parsed;
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="font-semibold text-ink">{stage.fileName}</p>
          <p className="text-sm text-ink-muted">{p.exportedAt ? `Backup from ${new Date(p.exportedAt).toLocaleString()}` : "BirthdayBook backup"}</p>
          <CountList counts={p.counts} />
        </div>
        <ErrorsList errors={p.errors.map((m) => ({ sheet: "Backup", row: 0, message: m }))} />
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => commitFull("replace", p.data, "restoring a backup")}>
            Replace everything with this backup
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => commitFull("merge", p.data, "merging a backup")}>
            Merge into current data
          </Button>
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- Full BirthdayBook workbook ---------- */
  if (stage.kind === "full") {
    const c = Object.fromEntries(Object.entries(stage.data).filter(([k]) => k !== "preferences").map(([k, v]) => [k, (v as unknown[]).length]));
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-ink" aria-hidden />
            <p className="font-semibold text-ink">BirthdayBook workbook detected</p>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{stage.wb.fileName} · sheets: {stage.wb.sheets.map((s) => s.name).join(", ")}</p>
          <CountList counts={c} />
        </div>
        <ErrorsList errors={stage.errors} />
        <Field label="Dates like 03/04/1990 mean" htmlFor="full-order">
          <Select
            id="full-order"
            value={dateOrder}
            onChange={(e) => {
              const v = e.target.value as typeof dateOrder;
              setDateOrder(v);
              const res = parseBirthdayBookWorkbook(stage.wb, v);
              setStage({ ...stage, data: res.data, errors: res.errors });
            }}
            className="sm:w-72"
          >
            <option value="DMY">3 April (day first)</option>
            <option value="MDY">March 4 (month first)</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} onClick={() => commitFull("merge", stage.data, "importing a workbook")}>
            Merge (update matching IDs, add new)
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => commitFull("replace", stage.data, "replacing from a workbook")}>
            Replace all data
          </Button>
          {stage.errors.length > 0 && (
            <Button variant="ghost" icon={FileDown} onClick={() => saveFile(errorReportCsv(stage.errors), "BirthdayBook_import_errors.csv", "text/csv")}>
              Error report
            </Button>
          )}
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- Column mapping ---------- */
  const sheet = stage.wb.sheets[stage.sheetIndex];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{stage.wb.fileName}</p>
          <p className="text-sm text-ink-muted">
            {sheet.rows.length} rows · {sheet.headers.length} columns
          </p>
        </div>
        {stage.wb.sheets.length > 1 && (
          <Field label="Worksheet" htmlFor="imp-sheet">
            <Select
              id="imp-sheet"
              value={stage.sheetIndex}
              onChange={(e) => {
                const i = Number(e.target.value);
                setStage({ ...stage, sheetIndex: i, mapping: guessMapping(stage.wb.sheets[i].headers) });
              }}
              className="w-48"
            >
              {stage.wb.sheets.map((s, i) => (
                <option key={s.name} value={i}>
                  {s.name} ({s.rows.length})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Dates like 03/04/1990 mean" htmlFor="imp-order">
          <Select id="imp-order" value={dateOrder} onChange={(e) => setDateOrder(e.target.value as typeof dateOrder)} className="w-52">
            <option value="DMY">3 April (day first)</option>
            <option value="MDY">March 4 (month first)</option>
          </Select>
        </Field>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">Match your columns</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sheet.headers.map((h, i) => (
            <div key={`${h}-${i}`} className="rounded-xl border border-line p-2.5">
              <p className="mb-1.5 truncate text-sm font-medium text-ink" title={h}>
                {h}
                <span className="ml-1.5 font-normal text-ink-faint">e.g. {String(sheet.rows.find((r) => r[i] !== "" && r[i] != null)?.[i] ?? "—").slice(0, 24)}</span>
              </p>
              <Select
                aria-label={`Map column ${h}`}
                className="h-10"
                value={stage.mapping[i]}
                onChange={(e) => {
                  const m = [...stage.mapping];
                  const f = e.target.value as MappableField;
                  // A field can be mapped once; clear any previous column.
                  if (f !== "ignore") m.forEach((x, j) => x === f && (m[j] = "ignore"));
                  m[i] = f;
                  setStage({ ...stage, mapping: m });
                }}
              >
                {MAPPABLE_FIELDS.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
        {mappingProblem && (
          <p className="mt-2 flex items-center gap-2 text-sm text-amber-ink" role="alert">
            <AlertTriangle className="size-4" aria-hidden /> {mappingProblem}
          </p>
        )}
      </section>

      {!mappingProblem && preview && counts && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green" icon={CheckCircle2}>{counts.valid} ready</Badge>
            {counts.duplicates > 0 && <Badge tone="plum" icon={Copy}>{counts.duplicates} already in BirthdayBook</Badge>}
            {counts.errors > 0 && <Badge tone="danger" icon={XCircle}>{counts.errors} with errors</Badge>}
            {counts.warnings > 0 && <Badge tone="amber" icon={AlertTriangle}>{counts.warnings} warnings</Badge>}
          </div>

          <div className="max-h-96 overflow-auto rounded-2xl border border-line">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="sticky top-0 bg-surface-2 text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Birthday</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((r) => (
                  <tr key={r.row} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-ink-faint tabular-nums">{r.row}</td>
                    <td className="px-3 py-2 text-ink">{r.person ? fullName(r.person) : "—"}</td>
                    <td className="px-3 py-2 text-ink">{r.person ? formatMonthDay(r.person.birthMonth, r.person.birthDay, r.person.birthYear) : "—"}</td>
                    <td className="px-3 py-2">
                      {r.errors.length ? (
                        <span className="text-danger">{r.errors.join("; ")}</span>
                      ) : r.duplicateOfId ? (
                        <span className="text-plum">Matches {r.duplicateOfName}</span>
                      ) : (
                        <span className="text-green-ink">New</span>
                      )}
                      {r.warnings.length > 0 && <span className="block text-xs text-amber-ink">{r.warnings.join("; ")}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 200 && <p className="p-3 text-center text-xs text-ink-muted">Showing the first 200 of {preview.length} rows.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {counts.duplicates > 0 && (
              <Field label="When a person already exists" htmlFor="imp-dupe">
                <Select id="imp-dupe" value={strategy} onChange={(e) => setStrategy(e.target.value as DuplicateStrategy)}>
                  <option value="skip">Skip them (keep what&apos;s in BirthdayBook)</option>
                  <option value="update">Update them with the spreadsheet values</option>
                  <option value="keep-both">Import anyway as a separate person</option>
                </Select>
              </Field>
            )}
            <div className="flex items-end">
              <Switch checked={withReminders} onChange={setWithReminders} label="Add default reminders to new people" />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button loading={busy} disabled={!!mappingProblem || !counts?.valid} onClick={commitMapping}>
          Import {counts?.valid ?? 0} {counts?.valid === 1 ? "person" : "people"}
        </Button>
        {preview && counts && (counts.errors > 0 || counts.warnings > 0) && (
          <Button variant="secondary" icon={FileDown} onClick={() => saveFile(previewErrorsCsv(preview), "BirthdayBook_import_report.csv", "text/csv")}>
            Download error report
          </Button>
        )}
        <Button variant="ghost" icon={RotateCcw} onClick={reset}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function CountList({ counts }: { counts: Record<string, number> }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {Object.entries(counts).map(([k, v]) => (
        <li key={k}>
          <Badge tone={v ? "plum" : "neutral"}>
            {v} {k}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function ErrorsList({ errors }: { errors: Array<{ sheet: string; row: number; message: string }> }) {
  if (!errors.length) return null;
  return (
    <details className="rounded-2xl border border-amber-ink/30 bg-amber-soft p-3 text-sm">
      <summary className="cursor-pointer font-medium text-amber-ink">
        {errors.length} row{errors.length > 1 ? "s" : ""} will be skipped
      </summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-ink">
        {errors.slice(0, 100).map((e, i) => (
          <li key={i}>
            {e.sheet}
            {e.row ? ` row ${e.row}` : ""}: {e.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
