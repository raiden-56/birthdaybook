"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BellRing,
  CalendarDays,
  FileSpreadsheet,
  Gift,
  Heart,
  House,
  LayoutGrid,
  MessageCircleHeart,
  Palette,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/components/providers/AppProvider";
import { HealthDot } from "@/components/reminders/HealthBadge";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_MAIN: NavItem[] = [
  { href: "/", label: "Today", icon: House },
  { href: "/calendar/", label: "Calendar", icon: CalendarDays },
  { href: "/people/", label: "People", icon: Users },
  { href: "/occasions/", label: "Occasions", icon: Heart },
  { href: "/alarms/", label: "Alarm Centre", icon: BellRing },
];

export const NAV_PLAN: NavItem[] = [
  { href: "/gifts/", label: "Gift Planner", icon: Gift },
  { href: "/cards/", label: "Card Studio", icon: Palette },
  { href: "/messages/", label: "Messages", icon: MessageCircleHeart },
  { href: "/stats/", label: "Statistics", icon: BarChart3 },
];

export const NAV_DATA: NavItem[] = [
  { href: "/data/", label: "Excel & Backup", icon: FileSpreadsheet },
  { href: "/settings/", label: "Settings", icon: Settings },
];

const NAV_MOBILE: NavItem[] = [
  { href: "/", label: "Today", icon: House },
  { href: "/calendar/", label: "Calendar", icon: CalendarDays },
  { href: "/people/", label: "People", icon: Users },
  { href: "/alarms/", label: "Alarms", icon: BellRing },
  { href: "/more/", label: "More", icon: LayoutGrid },
];

function isActive(pathname: string, href: string) {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (href === "/") return p === "/";
  if (href === "/people/" && p.startsWith("/person/")) return true;
  if (href === "/more/") return [...NAV_PLAN, ...NAV_DATA, { href: "/occasions/" }].some((i) => p.startsWith(i.href)) || p.startsWith("/more/");
  return p.startsWith(href);
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="16" fill="#563B5C" />
      <path d="M20 16h16c7 0 11 3.6 11 9 0 3.6-2 6.2-5 7.4 4 1.1 6.5 4 6.5 8.2 0 6-4.7 9.4-12 9.4H20V16Z" fill="#FAF9F6" />
      <path d="M27 22.5v8h8.2c3 0 4.8-1.5 4.8-4s-1.8-4-4.8-4H27Zm0 13.6v8.4h9c3.3 0 5.3-1.6 5.3-4.2s-2-4.2-5.3-4.2h-9Z" fill="#563B5C" />
      <circle cx="49" cy="15" r="5" fill="#E78B79" />
    </svg>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
        active ? "bg-plum-soft text-plum" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
      )}
    >
      <Icon className="size-[19px]" aria-hidden />
      <span>{item.label}</span>
      {item.href === "/alarms/" && <HealthDot className="ml-auto" />}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { data } = useApp();

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[120] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>

      {/* Desktop / tablet-landscape sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/70 backdrop-blur lg:flex">
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-6">
          <BrandMark />
          <div>
            <p className="font-display text-xl leading-none font-semibold text-ink">BirthdayBook</p>
            <p className="mt-1 text-xs text-ink-muted">{data.people.length} people · private &amp; offline</p>
          </div>
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-6">
          <div className="flex flex-col gap-0.5">
            {NAV_MAIN.map((i) => (
              <SideLink key={i.href} item={i} active={isActive(pathname, i.href)} />
            ))}
          </div>
          <div>
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Plan</p>
            <div className="flex flex-col gap-0.5">
              {NAV_PLAN.map((i) => (
                <SideLink key={i.href} item={i} active={isActive(pathname, i.href)} />
              ))}
            </div>
          </div>
          <div>
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Data</p>
            <div className="flex flex-col gap-0.5">
              {NAV_DATA.map((i) => (
                <SideLink key={i.href} item={i} active={isActive(pathname, i.href)} />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <BrandMark size={30} />
          <span className="font-display text-lg font-semibold text-ink">BirthdayBook</span>
        </div>
      </div>

      <main id="main" className="bottom-nav-space lg:pl-64">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-10 lg:pt-10"
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom navigation (≤5 items) */}
      <nav
        aria-label="Primary"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid h-[4.25rem] max-w-xl grid-cols-5">
          {NAV_MOBILE.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-plum" : "text-ink-muted",
                  )}
                >
                  {active && (
                    <motion.span layoutId="nav-pill" className="absolute top-1.5 h-8 w-14 rounded-full bg-plum-soft" transition={{ type: "spring", damping: 30, stiffness: 400 }} />
                  )}
                  <span className="relative">
                    <Icon className="size-[22px]" aria-hidden />
                    {item.href === "/alarms/" && <HealthDot className="absolute -top-0.5 -right-1" />}
                  </span>
                  <span className="relative">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
