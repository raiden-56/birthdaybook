"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Gift, GiftStatus } from "@/types";
import { GIFT_STATUSES } from "@/types";
import { useApp } from "@/components/providers/AppProvider";
import { Badge, Button, Input, Select } from "@/components/ui/primitives";
import { GIFT_STATUS_LABEL, giftsFor, nextGiftStatus } from "@/services/gifts/gifts";
import { formatMoney } from "@/lib/utils";

const STATUS_TONE: Record<GiftStatus, "neutral" | "plum" | "amber" | "coral" | "green"> = {
  idea: "neutral",
  planned: "plum",
  purchased: "amber",
  wrapped: "coral",
  given: "green",
};

export function GiftEditor({ personId, year }: { personId: string; year: number }) {
  const { data, repo } = useApp();
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const all = giftsFor(data, personId);
  const current = all.filter((g) => g.year === year);
  const past = all.filter((g) => g.year !== year);
  const cur = data.preferences.currency;

  const advance = (g: Gift) => repo.upsert("gifts", { ...g, status: nextGiftStatus(g.status) });

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await repo.addGift({ personId, title: title.trim(), status: "idea", budget: budget ? Number(budget) : undefined, year });
          setTitle("");
          setBudget("");
        }}
      >
        <Input aria-label="Gift idea" placeholder="Gift idea" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-[2]" />
        <Input aria-label={`Budget (${cur})`} placeholder={`Budget (${cur})`} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} className="w-32 flex-1" />
        <Button type="submit" variant="soft" icon={Plus} disabled={!title.trim()}>
          Add
        </Button>
      </form>

      {current.length === 0 ? (
        <p className="text-sm text-ink-muted">No gifts planned for {year}.</p>
      ) : (
        <ul className="space-y-2">
          {current.map((g) => (
            <GiftRow key={g.id} gift={g} currency={cur} onAdvance={() => advance(g)} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-muted">Previous years ({past.length}) — avoid repeats</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {past.map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span className="text-ink">{g.title}</span>
                <span className="text-ink-muted">
                  {g.year} · {GIFT_STATUS_LABEL[g.status]}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function GiftRow({ gift: g, currency, onAdvance, personName }: { gift: Gift; currency: string; onAdvance: () => void; personName?: string }) {
  const { repo } = useApp();
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{g.title}</p>
          <p className="text-sm text-ink-muted">
            {personName && <>{personName} · </>}
            Budget {formatMoney(g.budget, currency)}
            {g.price != null && <> · Paid {formatMoney(g.price, currency)}</>}
          </p>
        </div>
        <Badge tone={STATUS_TONE[g.status]}>{GIFT_STATUS_LABEL[g.status]}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {g.status !== "given" && (
          <Button size="sm" variant="soft" onClick={onAdvance}>
            Mark {GIFT_STATUS_LABEL[nextGiftStatus(g.status)].toLowerCase()}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
          {editing ? "Done" : "Details"}
        </Button>
        {g.link && (
          <a href={g.link} target="_blank" rel="noreferrer noopener" className="inline-flex h-9 items-center gap-1 px-2 text-sm font-medium text-plum hover:underline">
            Link <ExternalLink className="size-3.5" aria-hidden />
          </a>
        )}
        <Button size="icon" variant="ghost" aria-label={`Delete ${g.title}`} className="ml-auto size-9" onClick={() => repo.remove("gifts", g.id)}>
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Select aria-label="Status" value={g.status} onChange={(e) => repo.upsert("gifts", { ...g, status: e.target.value as GiftStatus })} className="h-10">
            {GIFT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {GIFT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Input aria-label="Price paid" placeholder="Price paid" inputMode="decimal" className="h-10" defaultValue={g.price ?? ""} onBlur={(e) => repo.upsert("gifts", { ...g, price: e.target.value ? Number(e.target.value) : undefined })} />
          <Input aria-label="Link" placeholder="https://…" type="url" className="h-10" defaultValue={g.link ?? ""} onBlur={(e) => repo.upsert("gifts", { ...g, link: e.target.value.trim() || undefined })} />
        </div>
      )}
    </li>
  );
}
