"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MotionConfig } from "framer-motion";
import type { BirthdayBookData, ReminderHealth } from "@/types";
import { BirthdayRepository } from "@/services/storage/repository";
import { MemoryAdapter, type StorageAdapter } from "@/services/storage/adapter";
import { emptyData } from "@/services/storage/normalize";
import { ReminderScheduler, type ReconcileResult } from "@/services/reminders/scheduler";
import type { NotificationAdapter, PermissionState } from "@/services/notifications/types";
import { getPlatform, type PlatformName } from "@/platform";
import { currentTimezone } from "@/lib/utils";
import { withBase } from "@/lib/basePath";
import { ToastHost, type ToastInput, type ToastItem } from "@/components/ui/Toast";

interface AppContextValue {
  ready: boolean;
  data: BirthdayBookData;
  repo: BirthdayRepository;
  scheduler: ReminderScheduler | null;
  platform: PlatformName;
  permission: PermissionState;
  health: ReminderHealth;
  exactAlarm: "granted" | "denied" | "not-applicable";
  lastResult: ReconcileResult | null;
  storageName: string;
  reconcile: (reason?: string) => Promise<ReconcileResult | null>;
  requestPermission: () => Promise<PermissionState>;
  refreshPermission: () => Promise<void>;
  toast: (t: ToastInput) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function createAdapters(platform: PlatformName): Promise<{ storage: StorageAdapter; notifications: NotificationAdapter }> {
  if (platform === "web") {
    const [{ IndexedDbAdapter }, { WebNotificationAdapter }] = await Promise.all([
      import("@/platform/web/indexeddb-adapter"),
      import("@/platform/web/web-notifications"),
    ]);
    const storage: StorageAdapter = typeof indexedDB !== "undefined" ? new IndexedDbAdapter() : new MemoryAdapter();
    return { storage, notifications: new WebNotificationAdapter() };
  }
  const [{ NativeFilesystemAdapter }, { NativeNotificationAdapter }] = await Promise.all([
    import("@/platform/native/filesystem-adapter"),
    import("@/platform/native/local-notifications"),
  ]);
  return { storage: new NativeFilesystemAdapter(), notifications: new NativeNotificationAdapter(platform) };
}

function applyTheme(theme: "light" | "dark" | "system") {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#161317" : "#FAF9F6");
}

const placeholderRepo = new BirthdayRepository(new MemoryAdapter());

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<BirthdayRepository>(placeholderRepo);
  const [scheduler, setScheduler] = useState<ReminderScheduler | null>(null);
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<PlatformName>("web");
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [exactAlarm, setExactAlarm] = useState<"granted" | "denied" | "not-applicable">("not-applicable");
  const [lastResult, setLastResult] = useState<ReconcileResult | null>(null);
  const [stateTick, setStateTick] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const empty = useMemo(() => emptyData(), []);

  const data = useSyncExternalStore(
    repo.subscribe,
    () => (repo.isLoaded ? repo.getSnapshot() : empty),
    () => empty,
  );

  const toast = useCallback((t: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs, { id, ...t }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.duration ?? 4200);
  }, []);

  // Boot: pick adapters, load data, init notifications, reconcile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = getPlatform();
      setPlatform(p);
      const { storage, notifications } = await createAdapters(p);
      const r = new BirthdayRepository(storage);
      try {
        await r.init();
      } catch (err) {
        console.error("[BirthdayBook] storage failed, using memory", err);
        toast({ tone: "danger", title: "Storage unavailable", body: "Changes in this session won't be saved. Export a backup before closing." });
      }
      if (cancelled) return;
      applyTheme(r.getSnapshot().preferences.theme);
      const s = new ReminderScheduler(r, notifications);
      await s.loadState();
      setRepo(r);
      setScheduler(s);
      setReady(true);

      try {
        await notifications.init({
          onAction: async (action, extra, title, body) => {
            if (!extra) return;
            if (action === "snooze-1h" || action === "snooze-tomorrow") {
              const minutes = action === "snooze-1h" ? 60 : 24 * 60;
              await s.snooze(extra, title ?? "Reminder", body ?? "", minutes);
              toast({ tone: "info", title: action === "snooze-1h" ? "Snoozed for 1 hour" : "Snoozed until tomorrow" });
            } else if (action === "mark-wished" && extra.targetId && extra.targetKind && extra.eventYear) {
              await r.setWish(extra.targetKind, extra.targetId, extra.eventYear, { status: "sent", sentAt: new Date().toISOString() });
              toast({ tone: "success", title: "Marked as wished" });
            } else if (action === "tap" && extra.targetId) {
              const path = extra.targetKind === "occasion" ? `/occasions/?focus=${extra.targetId}` : `/person/?id=${extra.targetId}`;
              window.location.assign(withBase(path));
            }
          },
        });
        const perm = await notifications.permission();
        setPermission(perm);
        setExactAlarm(await notifications.exactAlarmStatus());
        if (perm === "granted") setLastResult(await s.reconcile("app start"));
        setStateTick((x) => x + 1);
      } catch (err) {
        console.error("[BirthdayBook] notification init failed", err);
      }

      // Native: re-check on resume (permission may have changed in Settings, timezone may have changed).
      if (p !== "web") {
        const { App } = await import("@capacitor/app");
        App.addListener("resume", async () => {
          const perm = await notifications.permission();
          setPermission(perm);
          setExactAlarm(await notifications.exactAlarmStatus());
          if (perm === "granted") setLastResult(await s.reconcile("resume"));
          setStateTick((x) => x + 1);
        });
      } else {
        document.addEventListener("visibilitychange", async () => {
          if (document.visibilityState !== "visible") return;
          const perm = await notifications.permission();
          setPermission(perm);
          if (perm === "granted" && s.state.lastTimezone !== currentTimezone()) {
            setLastResult(await s.reconcile("timezone change"));
            setStateTick((x) => x + 1);
          }
        });
      }

      // Service worker for offline + PWA install (web only).
      if (p === "web" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register(withBase("/sw.js"), { scope: withBase("/") }).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Re-apply theme when the preference or system scheme changes.
  useEffect(() => {
    if (!ready) return;
    applyTheme(data.preferences.theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme(data.preferences.theme);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [ready, data.preferences.theme]);

  // Auto-reconcile shortly after any data change that affects reminders.
  useEffect(() => {
    if (!ready || !scheduler || permission !== "granted") return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      if (scheduler.health(repo.getSnapshot(), permission) === "needs-refresh") {
        setLastResult(await scheduler.reconcile("data changed"));
        setStateTick((x) => x + 1);
      }
    }, 1200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [data, ready, scheduler, permission, repo]);

  const reconcile = useCallback(
    async (reason = "manual") => {
      if (!scheduler) return null;
      const perm = await scheduler.adapter.permission();
      setPermission(perm);
      const res = await scheduler.reconcile(reason);
      setLastResult(res);
      setStateTick((x) => x + 1);
      return res;
    },
    [scheduler],
  );

  const requestPermission = useCallback(async () => {
    if (!scheduler) return "unsupported" as PermissionState;
    const perm = await scheduler.adapter.requestPermission();
    setPermission(perm);
    if (perm === "granted") {
      setLastResult(await scheduler.reconcile("permission granted"));
      setStateTick((x) => x + 1);
    }
    return perm;
  }, [scheduler]);

  const refreshPermission = useCallback(async () => {
    if (!scheduler) return;
    setPermission(await scheduler.adapter.permission());
    setExactAlarm(await scheduler.adapter.exactAlarmStatus());
  }, [scheduler]);

  const health: ReminderHealth = useMemo(() => {
    void stateTick;
    if (!scheduler) return "needs-refresh";
    return scheduler.health(data, permission);
  }, [scheduler, data, permission, stateTick]);

  const value: AppContextValue = {
    ready,
    data,
    repo,
    scheduler,
    platform,
    permission,
    health,
    exactAlarm,
    lastResult,
    storageName: repo.adapterName,
    reconcile,
    requestPermission,
    refreshPermission,
    toast,
  };

  return (
    <AppContext.Provider value={value}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      <ToastHost toasts={toasts} onDismiss={(id) => setToasts((xs) => xs.filter((x) => x.id !== id))} />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
