import type { BirthdayBookData, Gift, GiftStatus } from "@/types";

export const GIFT_STATUS_LABEL: Record<GiftStatus, string> = {
  idea: "Idea",
  planned: "Planned",
  purchased: "Purchased",
  wrapped: "Wrapped",
  given: "Given",
};

export function nextGiftStatus(s: GiftStatus): GiftStatus {
  const order: GiftStatus[] = ["idea", "planned", "purchased", "wrapped", "given"];
  return order[Math.min(order.length - 1, order.indexOf(s) + 1)];
}

export interface GiftSummary {
  year: number;
  count: number;
  budget: number;
  spent: number;
  byStatus: Record<GiftStatus, number>;
  peopleWithoutGift: number;
}

/** Spend = recorded price for purchased/wrapped/given gifts. */
export function giftSummary(data: BirthdayBookData, year: number, upcomingPersonIds: string[] = []): GiftSummary {
  const gifts = data.gifts.filter((g) => g.year === year);
  const byStatus = { idea: 0, planned: 0, purchased: 0, wrapped: 0, given: 0 } as Record<GiftStatus, number>;
  let budget = 0;
  let spent = 0;
  for (const g of gifts) {
    byStatus[g.status]++;
    budget += g.budget ?? 0;
    if (g.status !== "idea" && g.status !== "planned") spent += g.price ?? g.budget ?? 0;
  }
  const covered = new Set(gifts.map((g) => g.personId));
  return {
    year,
    count: gifts.length,
    budget,
    spent,
    byStatus,
    peopleWithoutGift: upcomingPersonIds.filter((id) => !covered.has(id)).length,
  };
}

export function giftsFor(data: BirthdayBookData, personId: string): Gift[] {
  return data.gifts
    .filter((g) => g.personId === personId)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

/** Previous years' gifts, so the user never repeats a present. */
export function pastGiftTitles(data: BirthdayBookData, personId: string, beforeYear: number): string[] {
  return data.gifts
    .filter((g) => g.personId === personId && g.year < beforeYear && g.status === "given")
    .map((g) => `${g.title} (${g.year})`);
}
