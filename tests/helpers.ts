import type { BirthdayBookData, Person, ReminderRule } from "@/types";
import { emptyData } from "@/services/storage/normalize";

let n = 0;
export function person(partial: Partial<Person> = {}): Person {
  n++;
  return {
    id: `p${n}`,
    firstName: `Person${n}`,
    lastName: "Test",
    relationship: "friend",
    birthMonth: 3,
    birthDay: 14,
    tags: [],
    favorite: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

export function rule(targetId: string, offsetDays: number, partial: Partial<ReminderRule> = {}): ReminderRule {
  return {
    id: `r-${targetId}-${offsetDays}${partial.customDate ?? ""}`,
    targetKind: "person",
    targetId,
    offsetDays,
    time: "09:00",
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

export function data(partial: Partial<BirthdayBookData> = {}): BirthdayBookData {
  return { ...emptyData(), ...partial };
}
