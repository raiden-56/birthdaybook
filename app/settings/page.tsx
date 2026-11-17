"use client";

import { useState } from "react";
import { Info, Monitor, Moon, Palette, ShieldCheck, Sun, Trash2, Wand2 } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Select, Spinner } from "@/components/ui/primitives";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { PLATFORM_LABEL } from "@/platform";
import { currentTimezone } from "@/lib/utils";
import { loadSampleData } from "@/lib/sample";
import type { ThemeMode } from "@/types";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "AED", "JPY", "NZD", "ZAR"];

export default function SettingsPage() {
  const { ready, data, repo, toast, platform, storageName, scheduler } = useApp();
  const [erase, setErase] = useState(false);
  const p = data.preferences;
  if (!ready) return <Spinner />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Appearance" icon={Palette} />
          <div className="space-y-4 px-5 pb-5">
            <Segmented<ThemeMode>
              label="Theme"
              value={p.theme}
              onChange={(theme) => repo.setPreferences({ theme })}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
            />
            <Field label="Week starts on" htmlFor="set-week">
              <Select id="set-week" value={p.weekStartsOn} onChange={(e) => repo.setPreferences({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </Select>
            </Field>
            <Field label="Currency for gift budgets" htmlFor="set-cur">
              <Select id="set-cur" value={p.currency} onChange={(e) => repo.setPreferences({ currency: e.target.value })}>
                {[...new Set([p.currency, ...CURRENCIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dates & reminders" icon={Info} />
          <div className="space-y-4 px-5 pb-5">
            <Field label="29 February birthdays in non-leap years" htmlFor="set-leap" hint="Can be overridden per person.">
              <Select id="set-leap" value={p.leapPolicy} onChange={(e) => repo.setPreferences({ leapPolicy: e.target.value as "feb28" | "mar1" })}>
                <option value="feb28">Celebrate on 28 February</option>
                <option value="mar1">Celebrate on 1 March</option>
              </Select>
            </Field>
            <Field label="Spreadsheet dates like 03/04/1990 mean" htmlFor="set-order">
              <Select id="set-order" value={p.dateOrder} onChange={(e) => repo.setPreferences({ dateOrder: e.target.value as "DMY" | "MDY" })}>
                <option value="DMY">3 April (day first)</option>
                <option value="MDY">March 4 (month first)</option>
              </Select>
            </Field>
            <Field label="Scheduling window (days ahead)" htmlFor="set-window" hint={platform === "ios" ? "iOS still caps the schedule at 64 notifications." : "How far ahead reminders are booked with the system."}>
              <Input id="set-window" type="number" min={14} max={400} value={p.scheduleWindowDays} onChange={(e) => repo.setPreferences({ scheduleWindowDays: Math.min(400, Math.max(14, Number(e.target.value) || 120)) })} />
            </Field>
            <Field label="Belated assistant looks back (days)" htmlFor="set-belated">
              <Input id="set-belated" type="number" min={1} max={60} value={p.belatedWindowDays} onChange={(e) => repo.setPreferences({ belatedWindowDays: Math.min(60, Math.max(1, Number(e.target.value) || 14)) })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="About this install" icon={ShieldCheck} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-sm">
            <dt className="text-ink-muted">Version</dt>
            <dd className="text-ink">BirthdayBook 2.0.0</dd>
            <dt className="text-ink-muted">Platform</dt>
            <dd className="text-ink">{PLATFORM_LABEL[platform]}</dd>
            <dt className="text-ink-muted">Storage</dt>
            <dd className="text-ink">{storageName}</dd>
            <dt className="text-ink-muted">Notifications</dt>
            <dd className="text-ink">{scheduler?.adapter.kind === "native" ? "Native local notifications" : "Browser notifications"}</dd>
            <dt className="text-ink-muted">Timezone</dt>
            <dd className="text-ink">{currentTimezone()}</dd>
            <dt className="text-ink-muted">Cloud / accounts</dt>
            <dd className="text-ink">None. Nothing leaves this device unless you export it.</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Data" icon={Trash2} />
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {data.people.length === 0 && (
              <Button variant="secondary" icon={Wand2} onClick={async () => { await loadSampleData(repo); toast({ tone: "success", title: "Sample data loaded" }); }}>
                Load sample data
              </Button>
            )}
            <Button variant="danger" icon={Trash2} onClick={() => setErase(true)}>
              Erase all data
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmSheet
        open={erase}
        onClose={() => setErase(false)}
        danger
        title="Erase everything?"
        confirmLabel="Erase all data"
        body="All people, occasions, reminders, gifts and notes are removed from this device. A safety snapshot is kept (Excel & Backup › Safety snapshots) until five newer ones replace it. Export a backup if you want a copy elsewhere."
        onConfirm={async () => {
          await repo.clearEverything();
          toast({ tone: "info", title: "All data erased" });
        }}
      />
    </div>
  );
}
