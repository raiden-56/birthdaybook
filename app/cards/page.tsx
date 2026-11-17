"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { Button, Card, Field, Input, PageHeader, Segmented, Spinner, Switch, Textarea } from "@/components/ui/primitives";
import { TargetPicker } from "@/components/events/TargetPicker";
import { useQueryParams } from "@/hooks/useQueryParams";
import { CARD_DESIGNS, CARD_FORMATS, type CardFormat } from "@/services/greeting-cards/templates";
import { renderCard } from "@/services/greeting-cards/render";
import { fillTemplate, messageTemplates, suggestedTone } from "@/services/greeting-cards/messages";
import { nextEventFor } from "@/services/calendar/events";
import { shareFileWeb } from "@/services/backup/files";
import { isNative } from "@/platform";
import { cn, downloadBlob } from "@/lib/utils";

export default function CardStudio() {
  const { ready, data, toast } = useApp();
  const params = useQueryParams();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState("");
  const [designId, setDesignId] = useState(CARD_DESIGNS[0].id);
  const [format, setFormat] = useState<CardFormat>("square");
  const [headline, setHeadline] = useState(CARD_DESIGNS[0].defaultHeadline);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("Wishing you a year full of good surprises.");
  const [signature, setSignature] = useState("With love");
  const [showBadge, setShowBadge] = useState(true);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const t = params?.get("target");
    if (t) setTarget(t);
  }, [params]);

  const design = CARD_DESIGNS.find((d) => d.id === designId)!;
  const [kind, id] = target.split(":") as ["person" | "occasion", string];
  const ev = useMemo(() => (target ? nextEventFor(data, kind, id) : undefined), [data, kind, id, target]);

  // Prefill from the chosen person/occasion.
  useEffect(() => {
    if (!ev) return;
    const person = kind === "person" ? data.people.find((p) => p.id === id) : undefined;
    setRecipient(person ? person.nickname || person.firstName : ev.title);
    const isAnniv = ev.type !== "birthday";
    setHeadline(isAnniv ? "Happy Anniversary" : design.defaultHeadline);
    const tpl = messageTemplates(person ? suggestedTone(person.relationship) : "warm", isAnniv ? "anniversary" : "birthday")[0];
    setMessage(fillTemplate(tpl, { name: person?.firstName ?? ev.title, age: ev.turning, years: ev.turning }));
  }, [ev]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (!canvas.current || !fontsReady) return;
    const css = getComputedStyle(document.documentElement);
    renderCard(
      canvas.current,
      design,
      format,
      { headline, recipient, message, signature, badge: showBadge && ev?.turning ? String(ev.turning) : undefined },
      { serif: css.getPropertyValue("--font-playfair") || "Georgia, serif", sans: css.getPropertyValue("--font-inter") || "system-ui, sans-serif" },
    );
  }, [design, format, headline, recipient, message, signature, showBadge, ev, fontsReady]);

  const fileName = `card-${(recipient || "birthday").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  async function exportPng(share: boolean) {
    const c = canvas.current;
    if (!c) return;
    if (isNative()) {
      const { shareImageNative } = await import("@/platform/native/files");
      await shareImageNative(c.toDataURL("image/png"), fileName, message);
      return;
    }
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    if (share && (await shareFileWeb(blob, fileName, "image/png", message))) return;
    downloadBlob(blob, fileName);
    toast({ tone: "success", title: "Card saved", body: fileName });
  }

  if (!ready) return <Spinner />;
  const { w, h } = CARD_FORMATS[format];

  return (
    <div>
      <PageHeader eyebrow="Greeting card studio" title="Make a card" description="Design it here, then save it as an image or share it straight to a chat." />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="order-2 space-y-5 lg:order-1">
          <Card className="space-y-4 p-5">
            <Field label="For" htmlFor="card-target">
              <TargetPicker id="card-target" value={target} onChange={setTarget} />
            </Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Design</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {CARD_DESIGNS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setDesignId(d.id);
                      if (headline === design.defaultHeadline) setHeadline(d.defaultHeadline);
                    }}
                    aria-pressed={d.id === designId}
                    aria-label={d.name}
                    className={cn("aspect-square rounded-xl border-2 transition-transform", d.id === designId ? "scale-[1.03] border-plum" : "border-transparent")}
                    style={{ background: `linear-gradient(135deg, ${d.background.join(", ")})` }}
                  >
                    <span className="sr-only">{d.name}</span>
                    <span className="mx-auto block h-1.5 w-1/2 rounded-full" style={{ background: d.accent }} aria-hidden />
                  </button>
                ))}
              </div>
            </div>
            <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
              <Segmented label="Format" value={format} onChange={setFormat} options={(Object.keys(CARD_FORMATS) as CardFormat[]).map((f) => ({ value: f, label: CARD_FORMATS[f].label.split(" (")[0] }))} />
            </div>
          </Card>
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Headline" htmlFor="c-head">
              <Input id="c-head" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} />
            </Field>
            <Field label="Name on card" htmlFor="c-name">
              <Input id="c-name" value={recipient} onChange={(e) => setRecipient(e.target.value)} maxLength={30} />
            </Field>
            <Field label="Message" htmlFor="c-msg" className="sm:col-span-2" hint={`${message.length}/260`}>
              <Textarea id="c-msg" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 260))} rows={4} />
            </Field>
            <Field label="Signed" htmlFor="c-sig">
              <Input id="c-sig" value={signature} onChange={(e) => setSignature(e.target.value)} maxLength={40} />
            </Field>
            <div className="flex items-end">
              <Switch checked={showBadge} onChange={setShowBadge} label="Show age badge" disabled={!ev?.turning} />
            </div>
          </Card>
        </div>

        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-8">
            <div className="mx-auto overflow-hidden rounded-2xl border border-line shadow-float" style={{ aspectRatio: `${w} / ${h}`, maxHeight: "70dvh" }}>
              <canvas ref={canvas} className="block h-full w-full" role="img" aria-label={`Card preview: ${headline} ${recipient}. ${message}`} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={Download} onClick={() => exportPng(false)}>
                Save image
              </Button>
              <Button icon={Share2} onClick={() => exportPng(true)}>
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
