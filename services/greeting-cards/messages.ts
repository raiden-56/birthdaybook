import type { Relationship } from "@/types";

export type MessageTone = "warm" | "funny" | "formal" | "short" | "heartfelt" | "belated";

export const TONES: Array<{ id: MessageTone; label: string }> = [
  { id: "warm", label: "Warm" },
  { id: "heartfelt", label: "Heartfelt" },
  { id: "funny", label: "Funny" },
  { id: "short", label: "Short" },
  { id: "formal", label: "Formal" },
  { id: "belated", label: "Belated" },
];

/**
 * Message templates. Placeholders: {name}, {age}, {ordinal}, {years}, {from}.
 * Written to sound like a person, not a greeting-card factory.
 */
const TEMPLATES: Record<MessageTone, string[]> = {
  warm: [
    "Happy birthday, {name}! Hope today is easy, full of good food and people who make you laugh.",
    "Happy birthday {name}. Thinking of you today and hoping the year ahead is a kind one.",
    "{name}, happy birthday! Wishing you a slow morning, a good cake and plenty of messages like this one.",
  ],
  heartfelt: [
    "Happy birthday, {name}. I don't say it enough, but I'm grateful you're in my life. Here's to you.",
    "{name}, another year of knowing you is another year I'm glad about. Happy birthday.",
    "Happy {ordinal} birthday, {name}. You've made a lot of people's lives better, mine included.",
  ],
  funny: [
    "Happy birthday {name}! Statistically, people with more birthdays live longer. Keep it up.",
    "{name}, you're not getting older, you're getting more vintage. Happy birthday!",
    "Happy birthday! I was going to get you something amazing, then I remembered you already know me.",
  ],
  short: [
    "Happy birthday, {name}!",
    "Happy birthday {name}, have a great day.",
    "Many happy returns, {name}!",
  ],
  formal: [
    "Dear {name}, wishing you a very happy birthday and a successful year ahead. Warm regards, {from}.",
    "Happy birthday, {name}. Best wishes for good health and continued success.",
    "Dear {name}, on behalf of all of us, a very happy birthday. Enjoy the day.",
  ],
  belated: [
    "{name}, I missed your birthday and I'm sorry. Happy belated birthday! Can I make it up to you with coffee?",
    "Happy belated birthday, {name}! Late, but I mean it just as much.",
    "My calendar let me down, but I didn't forget you. Happy belated birthday, {name}!",
  ],
};

const ANNIVERSARY: string[] = [
  "Happy anniversary, {name}! {years} years and still going strong.",
  "Wishing you both a happy anniversary. Here's to many more years together.",
  "Happy {ordinal} anniversary, {name}. You two make it look easy.",
];

export function messageTemplates(tone: MessageTone, kind: "birthday" | "anniversary" = "birthday"): string[] {
  return kind === "anniversary" && tone !== "belated" ? ANNIVERSARY : TEMPLATES[tone];
}

export function fillTemplate(
  template: string,
  vars: { name: string; age?: number; years?: number; from?: string },
): string {
  const ord = (n?: number) => {
    if (n == null) return "";
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return template
    .replace(/\{name\}/g, vars.name)
    .replace(/\{age\}/g, vars.age != null ? String(vars.age) : "")
    .replace(/\{years\}/g, vars.years != null ? String(vars.years) : "many")
    .replace(/\{ordinal\}/g, ord(vars.age ?? vars.years))
    .replace(/\{from\}/g, vars.from ?? "")
    .replace(/\s+([,.!])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*\./g, ".")
    .trim();
}

export function suggestedTone(rel: Relationship): MessageTone {
  if (rel === "client" || rel === "colleague") return "formal";
  if (rel === "partner" || rel === "family") return "heartfelt";
  return "warm";
}

export const DEFAULT_CHECKLIST = [
  "Choose a gift",
  "Buy or order the gift",
  "Write a card",
  "Plan the celebration",
  "Send wishes on the day",
];
