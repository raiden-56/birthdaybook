"use client";

import { useMemo } from "react";
import { BarChart3, Cake, CalendarDays, Heart, Sparkles, Star, Users } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Card, CardHeader, EmptyState, PageHeader, Spinner, Stat } from "@/components/ui/primitives";
import { BarChart } from "@/components/stats/BarChart";
import { computeStats } from "@/services/birthday/insights";
import { MONTHS, MONTHS_SHORT, RELATIONSHIP_LABEL } from "@/lib/labels";
import { RELATIONSHIPS } from "@/types";

export default function StatsPage() {
  const { ready, data } = useApp();
  const now = new Date();
  const s = useMemo(() => computeStats(data, now), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <Spinner />;
  if (!s.total)
    return (
      <>
        <PageHeader eyebrow="Statistics" title="Birthday statistics" />
        <Card>
          <EmptyState icon={BarChart3} title="Nothing to count yet" body="Add a few people to see patterns." />
        </Card>
      </>
    );

  const zodiac = Object.entries(s.zodiac).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Statistics" title="Birthday statistics" description="Patterns across everyone in your BirthdayBook." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="People" value={s.total} icon={Users} hint={`${s.favourites} in your close circle`} />
        <Stat label="Next 30 days" value={s.next30} icon={CalendarDays} />
        <Stat label="Average age" value={s.averageAge ?? "—"} icon={Cake} hint={`${s.withYear} with a known birth year`} />
        <Stat label={`Wished in ${now.getFullYear()}`} value={s.wishesSentThisYear} icon={Heart} hint={s.wishesMissedThisYear ? `${s.wishesMissedThisYear} missed` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Birthdays by month"
            description={s.busiestMonth != null ? `${MONTHS[s.busiestMonth]} is your busiest month. This month is highlighted.` : undefined}
            icon={CalendarDays}
          />
          <div className="px-5 pb-5">
            <BarChart label="Birthdays by month" data={s.byMonth.map((v, i) => ({ label: MONTHS_SHORT[i], value: v }))} highlightIndex={now.getMonth()} height={200} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Age groups" description="People with a known birth year" icon={Sparkles} />
          <div className="px-5 pb-5">
            <BarChart label="People by age group" data={s.ageBuckets.map((b) => ({ label: b.label, value: b.count }))} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Relationships" icon={Users} />
          <div className="px-5 pb-5">
            <BarChart
              label="People by relationship"
              data={RELATIONSHIPS.filter((r) => s.byRelationship[r] > 0).map((r) => ({ label: RELATIONSHIP_LABEL[r], value: s.byRelationship[r] }))}
            />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Star signs" description="Just for fun" icon={Star} />
          <ul className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-4 lg:grid-cols-6">
            {zodiac.map(([sign, n]) => (
              <li key={sign} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="text-sm text-ink">{sign}</span>
                <span className="font-display text-lg font-semibold text-ink tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
