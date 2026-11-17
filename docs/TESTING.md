# Testing

## Automated (runs anywhere)

```bash
npm test
```

62 Vitest tests in `tests/`:

| File | Covers |
|---|---|
| `dates.test.ts` | next/previous occurrence, today as next, year rollover, 29 Feb → 28 Feb / 1 Mar, leap-year ages, invalid dates, milestones, archived people, zodiac boundaries |
| `scheduler.test.ts` | multiple reminders per person, stable IDs and no duplicates, disabled and past reminders, iOS cap (60 of 64, soonest first), custom dates, leap-day reminders, year boundary, diffing after time/timezone changes, a full reconcile against a fake OS (idempotent re-runs, cancel after delete, reschedule after edit, **unconfirmed notifications are never reported as booked**, no scheduling without permission), health after timezone change and stale refresh |
| `excel.test.ts` | date formats (ISO, D/M/Y, M/D/Y, month names, no-year, Excel serials including 29 Feb 2000), column auto-mapping, relationship synonyms, import preview (duplicates, errors, warnings, row numbers), skip/update strategies, real Excel date cells, CSV import, **full workbook round trip of every sheet**, blank template, JSON backup round trip and validation, `.ics` output |
| `repository.test.ts` | persistence and reload, cascading deletes, snapshot before import and restore, snapshot retention |

```bash
npm run typecheck
```

```bash
npm run build
```

## Manual device checklist

These need real hardware and can't be automated in CI. Run them before each store release.

Tip: set a reminder for a few minutes from now. On a person, *Add on date* with today's date and a time 2–3 minutes ahead, or use **Alarm Centre → Send test** (fires in 10 s).

### Notifications – Android (test on Android 13+ and one older device)

| # | Steps | Expected |
|---|---|---|
| A1 | Fresh install, open app | No permission prompt on launch; dashboard shows *Permission required* |
| A2 | Tap *Allow notifications* → Allow | Health turns *Notifications enabled*; Alarm Centre shows booked = confirmed |
| A3 | Deny instead (A2) | Health *Notifications disabled*; Alarm Centre shows Settings steps; nothing reported as booked |
| A4 | Send test, then swipe the app away from recents | Notification arrives with the app closed |
| A5 | Schedule a reminder 3 min ahead, then reboot the phone | Notification still arrives after reboot |
| A6 | Settings → Apps → BirthdayBook → Notifications | Three channels exist: Upcoming celebration reminders, Celebration day, Snoozed reminders |
| A7 | Turn Sound off in Alarm Centre, refresh, send test | Silent notification (silent channel variant) |
| A8 | Leave *Precise timing* off | No "Alarms & reminders" screen ever opens |
| A9 | Turn *Precise timing* on | System "Alarms & reminders" screen opens once; the status shows granted or denied |
| A10 | Notification actions | *Snooze 1 hour* re-fires in an hour; *Mark as wished* updates the wish tracker |
| A11 | Battery saver / Xiaomi-style restrictions on | Delivery may be late; the Alarm Centre battery note explains the fix |

### Notifications – iOS (real device)

| # | Steps | Expected |
|---|---|---|
| I1 | Tap *Allow notifications* | System prompt once; health updates |
| I2 | Send test, lock the phone | Banner on lock screen |
| I3 | Kill the app, wait for a reminder | Arrives |
| I4 | Add 30+ people with 4 reminders each, open Alarm Centre | Meter shows ≤ 64 used; booked count = 60; "reaching" date shown |
| I5 | Long-press the notification | *Mark as wished*, *Snooze 1 hour*, *Remind tomorrow* |
| I6 | Settings → Notifications → BirthdayBook off, return to app | Health *Notifications disabled* (re-checked on resume) |

### Timezone and DST

| # | Steps | Expected |
|---|---|---|
| T1 | Change the device timezone (e.g. Asia/Kolkata → Europe/London), reopen the app | Health briefly *needs refreshing*, then auto-reconciles; reminders still fire at the same local wall-clock time |
| T2 | Reminder set across a DST change (Europe/US) | Fires at the configured local time, not shifted by an hour |

### Data

| # | Steps | Expected |
|---|---|---|
| D1 | Import an Excel file from device storage (Android Files / iOS Files) | Wizard opens with mapping and preview |
| D2 | Export workbook on Android, import on iPhone (or vice versa) | Same people, reminders, gifts, notes and IDs |
| D3 | Export → *Share* | Native share sheet with the `.xlsx` attached |
| D4 | Airplane mode, use the app (and the installed PWA) | Everything works; nothing needs the network |
| D5 | Import, then restore the *Before Excel import* snapshot | Data returns to the pre-import state |
| D6 | JSON backup → erase all data → restore backup | Identical data |

### Layout

Check at 375 px (small phone), a large phone, a tablet in portrait and landscape, and desktop, in both light and dark mode:

- No horizontal scrolling.
- Bottom navigation doesn't cover content, and safe areas are respected on notched iPhones.
- The calendar shows dots on phones and named chips on tablets and desktop.
- All controls are at least 44 × 44 px.
- Keyboard: Tab through the month grid, use the arrow keys to move days, and Escape to close sheets.
