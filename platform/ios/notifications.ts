/**
 * iOS specifics.
 *
 * iOS keeps at most 64 pending local notifications per app and silently
 * drops anything beyond the soonest 64. BirthdayBook therefore schedules a
 * rolling window: the soonest 60 reminders are handed to iOS (4 slots are
 * kept free for snoozes and test alerts) and the window is topped up every
 * time the app is opened or brought to the foreground.
 *
 * Practical effect: with 4 reminders per person, iOS holds roughly the next
 * 15 celebrations at any one time. Opening the app at least every few weeks
 * keeps the window full. The Alarm Centre shows exactly how far ahead the
 * iOS schedule currently reaches.
 */
export const IOS_PENDING_LIMIT = 64;
export const IOS_RESERVED_SLOTS = 4;

/** iOS notification category used for action buttons. */
export const IOS_CATEGORY = "BB_REMINDER";
