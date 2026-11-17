"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Single-series bar chart: one hue (plum) for magnitude, no legend (the card
 * title names the series), recessive grid, 4px rounded data-ends, per-bar
 * hover/focus tooltip, and an optional table view for screen readers and
 * exact values.
 */
export function BarChart({
  data,
  label,
  highlightIndex,
  height = 180,
}: {
  data: Array<{ label: string; value: number }>;
  label: string;
  highlightIndex?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];

  return (
    <figure>
      <div className="mb-2 flex justify-end">
        <button onClick={() => setTable((t) => !t)} className="min-h-9 rounded-lg px-2 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-ink" aria-pressed={table}>
          {table ? "Show chart" : "Show table"}
        </button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="py-1 font-medium">Group</th>
              <th className="py-1 text-right font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1.5 text-ink">{d.label}</td>
                <td className="py-1.5 text-right text-ink tabular-nums">{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative pl-7" style={{ height }} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
          {/* recessive grid */}
          {ticks.map((t) => (
            <div key={t} className="absolute right-0 left-7 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden>
              <span className="absolute -top-2 -left-7 w-6 text-right text-[11px] text-ink-faint tabular-nums">{t}</span>
            </div>
          ))}
          <div className="absolute inset-0 left-7 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const h = (d.value / top) * 100;
              const active = hover === i;
              return (
                <div
                  key={d.label}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`${d.label}: ${d.value}`}
                >
                  <div
                    className={cn(
                      "w-full max-w-9 rounded-t-[4px] transition-opacity",
                      i === highlightIndex ? "bg-coral" : "bg-plum",
                      hover != null && !active && "opacity-45",
                    )}
                    style={{ height: `${Math.max(d.value ? 2 : 0, h)}%` }}
                  />
                  {active && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap text-ink shadow-card" style={{ bottom: `${h}%` }}>
                      <span className="font-medium">{d.label}</span> · <span className="tabular-nums">{d.value}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {!table && (
        <div className="mt-1.5 flex gap-[2px] pl-7" aria-hidden>
          {data.map((d) => (
            <span key={d.label} className="flex-1 truncate text-center text-[11px] text-ink-muted">
              {d.label}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const out: number[] = [];
  for (let t = 0; t <= max + step - 1; t += step) out.push(t);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}
