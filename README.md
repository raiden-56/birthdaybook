# BirthdayBook 2.0

A birthday, anniversary and celebration manager for the web, Android and iPhone. Data stays on the device. There is no account, no server and no cloud database. Excel is the portable copy you move between devices.

- **Web:** a Next.js static site, installable as a PWA, works offline.
- **Android and iOS:** the same build wrapped by Capacitor 8, with real native local notifications booked with the operating system.

## What's in it

| Area | What it does |
|---|---|
| Today | Today's celebrations, a countdown to the next one, reminder health, belated assistant, milestones, gift status |
| Calendar | Month, week, day, agenda and year views. Swipe or arrow keys to move. Filter by type and relationship. `.ics` export |
| People | Search, filter, sort by next birthday. Profiles with reminders, a yearly checklist, gifts, relationship notes, wish history and linked occasions |
| Occasions | Anniversaries, weddings, work anniversaries, graduations, remembrance days, custom dates; recurring or one-off |
| Alarm Centre | Reminder health, what's booked and confirmed by the OS, test notification, default offsets, Android precise timing, iOS 64-slot meter |
| Gift Planner | Ideas → planned → purchased → wrapped → given, budgets, spend, who still needs a gift |
| Card Studio | Six canvas-drawn designs in three formats, saved as PNG or shared |
| Messages | Templates by tone (warm, heartfelt, funny, short, formal, belated); WhatsApp, SMS, email, share sheet; marks the wish as sent |
| Statistics | Birthdays by month, age groups, relationships, star signs |
| Excel & Backup | Import wizard with column mapping, preview, validation, duplicate handling and error reports; full workbook, CSV, JSON, `.ics` and template export; automatic safety snapshots |
| Settings | Light, dark or system theme, week start, currency, 29 February rule, import date order, scheduling window |

## Architecture

```
app/                    Next.js App Router pages (all client-rendered, static export)
components/             UI: primitives, layout, calendar, people, reminders, gifts, data…
hooks/                  useQueryParams (deep links that work inside Capacitor)
services/               Shared business logic – identical on every platform
  birthday/             date maths, leap years, ages, milestones, stats, belated assistant
  calendar/             celebration events per range, countdowns, .ics export
  reminders/            planner (pure) + scheduler (reconciles with the OS)
  notifications/        NotificationAdapter contract
  excel/                SheetJS read/write, column mapping, import preview, workbook schema
  storage/              StorageAdapter contract, repository, normalisation/validation
  backup/               JSON backup format, platform-aware save/share
  gifts/  greeting-cards/
platform/
  web/                  IndexedDB adapter, browser notification adapter
  native/               Filesystem storage adapter, Capacitor Local Notifications adapter, share/files
  android/              notification channels, exact-alarm handling
  ios/                  pending-notification limits, categories
lib/  types/            utilities, labels, sample data; the domain model
android/  ios/          Capacitor native projects (committed, buildable)
tests/                  Vitest unit tests
```

The UI only talks to `BirthdayRepository` and `ReminderScheduler`. Each takes an adapter chosen at start-up:

| | Web | Android / iOS |
|---|---|---|
| Storage | IndexedDB (one store per collection) + `localStorage` for the theme | JSON files in the app's private data directory with a `.bak` copy per write, plus Capacitor Preferences for small values |
| Notifications | Notification API + service worker, checked every 30 s while open | `@capacitor/local-notifications`, held by AlarmManager / UNUserNotificationCenter |
| Files | File System Access "Save as", otherwise download; Web Share | Capacitor Filesystem (Documents) + native share sheet |

**Why files instead of SQLite on native?** The data set is small (thousands of rows at most) and is always read whole. JSON files in `Directory.Data` are simple, crash-safe with the backup copy, and avoid iOS purging WebView storage under pressure. The `StorageAdapter` interface means an SQLite adapter could be added later without touching the UI.

### Reminder engine

1. `planNotifications()` turns every enabled reminder rule into concrete fire times in a rolling window (120 days by default), in local wall-clock time.
2. Each notification gets a stable 31-bit ID hashed from `kind:targetId:eventYear:ruleId`. Re-planning never creates duplicates, and an edited rule changes the fire time, which triggers a cancel and reschedule.
3. `ReminderScheduler.reconcile()` asks the OS what's pending, cancels what's no longer planned or has moved, schedules what's missing, then **reads the pending list back**. Only IDs the OS confirms are reported as booked.
4. Reconciliation runs on app start, on resume, about a second after any edit, and after a timezone change. The Android plugin restores alarms after a reboot, and the next app open reconciles again.
5. Health is one of: *Notifications enabled*, *Notifications disabled*, *Permission required*, *Schedule needs refreshing* (data, timezone or confirmations changed, or the last refresh is over 24 h old).

Platform limits are respected: iOS gets the soonest 60 of its 64 slots (4 kept for snoozes and tests). Android is capped at 400 of AlarmManager's 500.

**Android exact alarms.** In Capacitor Local Notifications 8.3, `isExactNotification` defaults to `true` and opens the "Alarms & reminders" settings screen on every schedule call. BirthdayBook sets it to `false` unless the user turns on *Precise timing*. Birthdays don't need minute precision, and the app never asks for a permission it doesn't need.

### Dates and leap years

Birthdays are stored as month, day and optional year, never as timestamps, so they can't drift across timezones. A 29 February birthday is observed on 28 February or 1 March in non-leap years (a global setting with a per-person override). Excel serial dates are converted to calendar parts in UTC maths, so imports don't shift by a day.

## Excel workbook

Sheets: **People, Occasions, Reminders, Gifts, Notes, Preferences**, plus **Wishes**, **Checklist** and a **Read Me**. Export → edit in Excel → import gives back the same records, IDs included (covered by tests).

Importing any other spreadsheet goes through the wizard: pick the worksheet, confirm the guessed column mapping (`Name`, `DOB`, `Mobile`, `Relation`…), choose day-first or month-first dates, review a row-by-row preview, decide what happens to duplicates (skip, update, or keep both), then import. A safety snapshot is taken first, and the error report downloads as CSV. The source file is never written to; every export is a new timestamped file.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 62 unit tests
npm run build        # static export to out/ (+ service worker precache list)
```

Native builds, signing and store release are covered in [docs/BUILD.md](docs/BUILD.md). The device test plan is in [docs/TESTING.md](docs/TESTING.md).

## Honest limits

- **Browsers can't book OS alarms.** Web reminders fire only while a BirthdayBook tab or the installed PWA is running; anything missed in the last 12 hours shows when you return. For reminders with the browser closed, use the `.ics` export (alarms included) or the mobile app.
- **Native notifications aren't guaranteed.** Users can block them, and Focus modes, Do Not Disturb and aggressive battery savers (common on Xiaomi, Oppo, Vivo, Realme, OnePlus and Samsung) can delay or drop them. The Alarm Centre explains the fix for each case.
- **iOS holds 64 pending notifications per app.** With four reminders per person, that's roughly the next 15 celebrations. Opening the app tops the window up.
- **No sync.** Moving data between devices means exporting Excel or JSON on one and importing on the other.
