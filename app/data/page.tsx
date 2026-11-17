"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Archive, CalendarArrowDown, DatabaseBackup, FileJson, FileSpreadsheet, FileText, History, Share2, ShieldCheck, Table2, Upload } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Card, CardHeader, PageHeader, Spinner } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { ImportWizard } from "@/components/data/ImportWizard";
import { blankTemplate, exportFileName, exportPeopleCsv, exportXlsx, XLSX_MIME } from "@/services/excel/workbook";
import { serializeBackup } from "@/services/backup/backup";
import { buildIcs } from "@/services/calendar/ics";
import { saveFile, type SaveResult } from "@/services/backup/files";
import type { Snapshot } from "@/services/storage/repository";
import { isNative } from "@/platform";

export default function DataPage() {
  const { ready, data, repo, toast, storageName, platform } = useApp();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [restoring, setRestoring] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (ready) void repo.listSnapshots().then(setSnapshots);
  }, [ready, repo, data]);

  function report(res: SaveResult, what: string) {
    if (res.method === "cancelled") return;
    const where =
      res.method === "native-share" ? "Shared" : res.method === "native-documents" ? "Saved to Documents/BirthdayBook" : res.method === "file-system-access" ? "Saved" : "Downloaded";
    toast({ tone: "success", title: `${what} ready`, body: where });
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await repo.flush();
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: "Export failed", body: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <Spinner />;
  const native = isNative();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Excel & backup"
        title="Your data, portable"
        description="Excel is the master copy you can take anywhere. Everything else lives only on this device."
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Import" description="Excel, CSV or a BirthdayBook backup" icon={Upload} />
          <div className="px-5 pb-5">
            <ImportWizard />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Export" description="Each export is a new dated file" icon={FileSpreadsheet} />
            <div className="grid gap-2 px-5 pb-5">
              <ExportButton
                icon={FileSpreadsheet}
                title="Full Excel workbook"
                body="People, Occasions, Reminders, Gifts, Notes, Preferences and more"
                loading={busy === "xlsx"}
                onClick={() => run("xlsx", async () => report(await saveFile(exportXlsx(data), exportFileName("xlsx"), XLSX_MIME), "Workbook"))}
              />
              <ExportButton
                icon={FileJson}
                title="JSON backup"
                body="Complete, exact copy for restoring on any device"
                loading={busy === "json"}
                onClick={() => run("json", async () => report(await saveFile(serializeBackup(data), exportFileName("json", "BirthdayBook_backup"), "application/json"), "Backup"))}
              />
              <ExportButton
                icon={Table2}
                title="People as CSV"
                body="For Google Sheets, Numbers or contact apps"
                loading={busy === "csv"}
                onClick={() => run("csv", async () => report(await saveFile("﻿" + exportPeopleCsv(data), exportFileName("csv", "BirthdayBook_people"), "text/csv"), "CSV"))}
              />
              <ExportButton
                icon={CalendarArrowDown}
                title="Calendar (.ics)"
                body="Google Calendar, Apple Calendar, Outlook – with alarms"
                loading={busy === "ics"}
                onClick={() => run("ics", async () => report(await saveFile(buildIcs(data), exportFileName("ics"), "text/calendar"), "Calendar"))}
              />
              <ExportButton
                icon={FileText}
                title="Blank template"
                body="An empty workbook with the right columns"
                loading={busy === "tpl"}
                onClick={() => run("tpl", async () => report(await saveFile(blankTemplate(), "BirthdayBook_template.xlsx", XLSX_MIME), "Template"))}
              />
              {!native && typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  variant="soft"
                  icon={Share2}
                  onClick={() => run("share", async () => report(await saveFile(exportXlsx(data), exportFileName("xlsx"), XLSX_MIME, { preferShare: true }), "Workbook"))}
                >
                  Share workbook
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Safety snapshots" description="Saved automatically before imports, restores and deletes" icon={History} />
            <div className="px-5 pb-5">
              {snapshots.length === 0 ? (
                <p className="text-sm text-ink-muted">None yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {snapshots.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-ink">{s.reason}</p>
                        <p className="text-xs text-ink-muted">
                          {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })} · {s.counts.people ?? 0} people
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setRestoring(s)}>
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex gap-3">
              <ShieldCheck className="size-5 shrink-0 text-green-ink" aria-hidden />
              <div className="text-sm text-ink-muted">
                <p className="font-medium text-ink">Stored on this {platform === "web" ? "browser" : "device"} only</p>
                <p className="mt-1">
                  {storageName === "indexeddb" && "Saved in this browser's IndexedDB. Clearing site data erases it, so export a backup regularly."}
                  {storageName === "native-filesystem" && "Saved in BirthdayBook's private app storage. Uninstalling the app erases it, so export a backup regularly."}
                  {storageName === "memory" && "Storage isn't available here. Changes are lost when you close the page – export before leaving."}
                </p>
                <p className="mt-1 flex items-center gap-1.5">
                  <DatabaseBackup className="size-4" aria-hidden /> {data.people.length} people · {data.occasions.length} occasions · {data.reminders.length} reminders · {data.gifts.length} gifts ·{" "}
                  {data.notes.length} notes
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmSheet
        open={!!restoring}
        onClose={() => setRestoring(null)}
        title="Restore this snapshot?"
        confirmLabel="Restore"
        body={
          <>
            Your current data is replaced by the snapshot &ldquo;{restoring?.reason}&rdquo;. A snapshot of what you have now is saved first, so this can be undone too.
          </>
        }
        onConfirm={async () => {
          if (!restoring) return;
          await repo.restoreSnapshot(restoring.id);
          toast({ tone: "success", title: "Snapshot restored" });
        }}
      />
    </div>
  );
}

function ExportButton({ icon: Icon, title, body, onClick, loading }: { icon: typeof Archive; title: string; body: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-line p-3 text-left transition-colors hover:border-plum/40 hover:bg-surface-2 disabled:opacity-60"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-soft text-green-ink">
        {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Icon className="size-5" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-sm text-ink-muted">{body}</span>
      </span>
    </button>
  );
}
