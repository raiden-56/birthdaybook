"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: "success" | "info" | "danger" | "warning";
  duration?: number;
}
export interface ToastItem extends ToastInput {
  id: string;
}

const ICON = { success: CheckCircle2, info: Info, danger: TriangleAlert, warning: TriangleAlert };
const TONE = {
  success: "text-green-ink",
  info: "text-plum",
  danger: "text-danger",
  warning: "text-amber-ink",
};

export function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:items-end lg:pr-6"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone ?? "info"];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-float"
              role={t.tone === "danger" ? "alert" : "status"}
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", TONE[t.tone ?? "info"])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-ink-muted">{t.body}</p>}
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className="-m-1.5 grid size-8 place-items-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink"
                aria-label="Dismiss"
              >
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
