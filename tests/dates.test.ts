import { describe, expect, it } from "vitest";
import {
  currentAge,
  isValidDate,
  nextOccurrence,
  observedDate,
  previousOccurrence,
  zodiacSign,
} from "@/services/birthday/dates";
import { eventsInRange, upcomingEvents } from "@/services/calendar/events";
import { data, person } from "./helpers";

describe("birthday dates", () => {
  it("returns this year's date when still ahead", () => {
    const r = nextOccurrence(12, 25, new Date(2026, 10, 17));
    expect(r.date).toEqual(new Date(2026, 11, 25));
    expect(r.year).toBe(2026);
  });

  it("rolls over to next year when already passed", () => {
    const r = nextOccurrence(3, 14, new Date(2026, 10, 17));
    expect(r.date).toEqual(new Date(2027, 2, 14));
  });

  it("treats today as the next occurrence", () => {
    const r = nextOccurrence(11, 17, new Date(2026, 10, 17, 23, 59));
    expect(r.date).toEqual(new Date(2026, 10, 17));
  });

  it("observes 29 Feb on 28 Feb in non-leap years by default", () => {
    expect(observedDate(2, 29, 2027).date).toEqual(new Date(2027, 1, 28));
    expect(observedDate(2, 29, 2027).shifted).toBe(true);
  });

  it("observes 29 Feb on 1 Mar with the mar1 policy", () => {
    expect(observedDate(2, 29, 2027, "mar1").date).toEqual(new Date(2027, 2, 1));
  });

  it("keeps 29 Feb in leap years", () => {
    expect(observedDate(2, 29, 2028).date).toEqual(new Date(2028, 1, 29));
    expect(observedDate(2, 29, 2028).shifted).toBe(false);
  });

  it("finds the next leap-day birthday across years", () => {
    const r = nextOccurrence(2, 29, new Date(2027, 2, 2));
    expect(r.date).toEqual(new Date(2028, 1, 29));
  });

  it("previous occurrence is strictly before today", () => {
    const r = previousOccurrence(11, 17, new Date(2026, 10, 17));
    expect(r.date).toEqual(new Date(2025, 10, 17));
  });

  it("validates impossible dates", () => {
    expect(isValidDate(2027, 2, 29)).toBe(false);
    expect(isValidDate(2028, 2, 29)).toBe(true);
    expect(isValidDate(undefined, 2, 29)).toBe(true);
    expect(isValidDate(2026, 4, 31)).toBe(false);
  });

  it("computes current age around the birthday", () => {
    expect(currentAge(1990, 11, 18, new Date(2026, 10, 17))).toBe(35);
    expect(currentAge(1990, 11, 17, new Date(2026, 10, 17))).toBe(36);
    expect(currentAge(undefined, 1, 1)).toBeUndefined();
  });

  it("computes leap-day ages in non-leap years", () => {
    expect(currentAge(2000, 2, 29, new Date(2027, 1, 27))).toBe(26);
    expect(currentAge(2000, 2, 29, new Date(2027, 1, 28))).toBe(27);
  });

  it("zodiac boundaries", () => {
    expect(zodiacSign(3, 21)).toBe("Aries");
    expect(zodiacSign(12, 25)).toBe("Capricorn");
    expect(zodiacSign(1, 19)).toBe("Capricorn");
    expect(zodiacSign(1, 20)).toBe("Aquarius");
  });
});

describe("calendar events", () => {
  it("shows birthdays every year in a range", () => {
    const d = data({ people: [person({ id: "a", birthMonth: 1, birthDay: 5, birthYear: 1990 })] });
    const evs = eventsInRange(d, new Date(2026, 0, 1), new Date(2028, 11, 31));
    expect(evs.map((e) => e.year)).toEqual([2026, 2027, 2028]);
    expect(evs[0].turning).toBe(36);
  });

  it("flags milestones", () => {
    const d = data({ people: [person({ id: "a", birthMonth: 12, birthDay: 1, birthYear: 1996 })] });
    const [ev] = upcomingEvents(d, new Date(2026, 10, 17), 30);
    expect(ev.turning).toBe(30);
    expect(ev.isMilestone).toBe(true);
  });

  it("skips archived people", () => {
    const d = data({ people: [person({ archived: true, birthMonth: 11, birthDay: 20 })] });
    expect(upcomingEvents(d, new Date(2026, 10, 17), 10)).toHaveLength(0);
  });

  it("includes leap-day people in non-leap Februaries", () => {
    const d = data({ people: [person({ id: "leap", birthMonth: 2, birthDay: 29 })] });
    const evs = eventsInRange(d, new Date(2027, 1, 1), new Date(2027, 1, 28));
    expect(evs).toHaveLength(1);
    expect(evs[0].shiftedFromLeapDay).toBe(true);
  });
});
