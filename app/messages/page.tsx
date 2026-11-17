"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle, MessageSquareText, Send, Share2 } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Spinner, Textarea } from "@/components/ui/primitives";
import { TargetPicker } from "@/components/events/TargetPicker";
import { useQueryParams } from "@/hooks/useQueryParams";
import { fillTemplate, messageTemplates, suggestedTone, TONES, type MessageTone } from "@/services/greeting-cards/messages";
import { nextEventFor } from "@/services/calendar/events";
import { previousOccurrence, daysUntil } from "@/services/birthday/dates";
import { belatedCandidates } from "@/services/birthday/insights";
import { isNative } from "@/platform";
import { cn } from "@/lib/utils";
import type { WishChannel } from "@/types";

export default function MessageCentre() {
  const { ready, data, repo, toast } = useApp();
  const params = useQueryParams();
  const [target, setTarget] = useState("");
  const [tone, setTone] = useState<MessageTone>("warm");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = params?.get("target");
    if (t) setTarget(t);
    const tn = params?.get("tone") as MessageTone | null;
    if (tn && TONES.some((x) => x.id === tn)) setTone(tn);
  }, [params]);

  const [kind, id] = target.split(":") as ["person" | "occasion", string];
  const person = kind === "person" ? data.people.find((p) => p.id === id) : undefined;
  const occasion = kind === "occasion" ? data.occasions.find((o) => o.id === id) : undefined;
  const ev = useMemo(() => (target ? nextEventFor(data, kind, id) : undefined), [data, kind, id, target]);

  // Set a sensible tone when the target changes (unless deep-linked as belated).
  useEffect(() => {
    if (person && params?.get("tone") !== "belated") setTone(suggestedTone(person.relationship));
  }, [person?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = person ? person.nickname || person.firstName : occasion?.title ?? "friend";
  const options = useMemo(
    () => messageTemplates(tone, ev && ev.type !== "birthday" ? "anniversary" : "birthday").map((t) => fillTemplate(t, { name, age: ev?.turning, years: ev?.turning, from })),
    [tone, ev, name, from],
  );

  useEffect(() => setText(options[0] ?? ""), [options]);

  // Which year does this wish count for? Today/upcoming, or the recent one for belated wishes.
  const wishYear = useMemo(() => {
    if (!ev) return undefined;
    if (tone !== "belated") return ev.year;
    const m = person ? person.birthMonth : occasion?.month;
    const d = person ? person.birthDay : occasion?.day;
    return m && d ? previousOccurrence(m, d, new Date()).year : ev.year;
  }, [ev, tone, person, occasion]);

  async function markSent(channel: WishChannel) {
    if (!wishYear || !target) return;
    const late = tone === "belated" || (ev && daysUntil(ev.date) > 300);
    await repo.setWish(kind, id, wishYear, { status: late ? "belated" : "sent", channel, message: text, sentAt: new Date().toISOString() });
  }

  async function share() {
    if (isNative()) {
      const { shareTextNative } = await import("@/platform/native/files");
      await shareTextNative(text, "Send wishes");
    } else if (navigator.share) {
      await navigator.share({ text }).catch(() => undefined);
    } else {
      await copy();
      return;
    }
    await markSent("message");
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
    toast({ tone: "success", title: "Copied", body: "Paste it into any chat." });
  }

  const phone = person?.phone?.replace(/[^\d+]/g, "");
  const belated = belatedCandidates(data);

  if (!ready) return <Spinner />;

  return (
    <div>
      <PageHeader eyebrow="Message centre" title="Write your wishes" description="Start from a suggestion, make it yours, and send it however you like." />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="For" htmlFor="msg-target">
              <TargetPicker id="msg-target" value={target} onChange={setTarget} />
            </Field>
            <Field label="Sign as (optional)" htmlFor="msg-from">
              <Input id="msg-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your name" />
            </Field>
          </div>
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
            <Segmented label="Tone" value={tone} onChange={setTone} options={TONES.map((t) => ({ value: t.id, label: t.label }))} />
          </div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <button
                key={i}
                onClick={() => setText(o)}
                aria-pressed={text === o}
                className={cn("w-full rounded-xl border p-3 text-left text-[15px] transition-colors", text === o ? "border-plum bg-plum-soft/60 text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink")}
              >
                {o}
              </button>
            ))}
          </div>
          <Field label="Your message" htmlFor="msg-text">
            <Textarea id="msg-text" value={text} onChange={(e) => setText(e.target.value)} rows={5} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button icon={Share2} onClick={share} disabled={!text}>
              Share
            </Button>
            <Button variant="secondary" icon={copied ? Check : Copy} onClick={copy} disabled={!text}>
              {copied ? "Copied" : "Copy"}
            </Button>
            {phone && (
              <>
                <a
                  href={`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() => markSent("message")}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-[15px] font-medium text-ink hover:bg-surface-2"
                >
                  <MessageCircle className="size-[18px]" aria-hidden /> WhatsApp
                </a>
                <a
                  href={`sms:${phone}?&body=${encodeURIComponent(text)}`}
                  onClick={() => markSent("message")}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-[15px] font-medium text-ink hover:bg-surface-2"
                >
                  <MessageSquareText className="size-[18px]" aria-hidden /> SMS
                </a>
              </>
            )}
            {person?.email && (
              <a
                href={`mailto:${person.email}?subject=${encodeURIComponent(tone === "belated" ? "Happy belated birthday!" : "Happy birthday!")}&body=${encodeURIComponent(text)}`}
                onClick={() => markSent("email")}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-[15px] font-medium text-ink hover:bg-surface-2"
              >
                <Mail className="size-[18px]" aria-hidden /> Email
              </a>
            )}
          </div>
          {target && (
            <Button
              variant="ghost"
              size="sm"
              icon={Send}
              onClick={async () => {
                await markSent("other");
                toast({ tone: "success", title: "Marked as wished", body: `${name} · ${wishYear}` });
              }}
            >
              I sent it another way — mark as wished
            </Button>
          )}
        </Card>

        <Card>
          <CardHeader title="Belated birthday assistant" description={`Missed in the last ${data.preferences.belatedWindowDays} days`} />
          <ul className="px-3 pb-4">
            {belated.length === 0 ? (
              <li className="px-2 py-3 text-sm text-ink-muted">You&apos;re all caught up.</li>
            ) : (
              belated.map((b) => (
                <li key={b.key}>
                  <button
                    onClick={() => {
                      setTarget(`${b.kind}:${b.targetId}`);
                      setTone("belated");
                    }}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 text-left hover:bg-surface-2"
                  >
                    <span className="truncate font-medium text-ink">{b.title}</span>
                    <span className="shrink-0 text-sm text-coral-ink">{-daysUntil(b.date)} days ago</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
