/**
 * Greeting card designs. Each design is drawn on a <canvas> (see render.ts),
 * so cards work offline and can be saved as PNG or shared through the native
 * share sheet.
 */

export interface CardDesign {
  id: string;
  name: string;
  background: string[]; // gradient stops
  ink: string;
  accent: string;
  pattern: "confetti" | "dots" | "petals" | "lines" | "none" | "stars";
  headlineFont: "serif" | "sans";
  defaultHeadline: string;
}

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: "plum-classic",
    name: "Plum classic",
    background: ["#563B5C", "#3E2843"],
    ink: "#FAF9F6",
    accent: "#E78B79",
    pattern: "confetti",
    headlineFont: "serif",
    defaultHeadline: "Happy Birthday",
  },
  {
    id: "lavender-soft",
    name: "Lavender morning",
    background: ["#F3EEF6", "#EAE2EF"],
    ink: "#29252B",
    accent: "#563B5C",
    pattern: "petals",
    headlineFont: "serif",
    defaultHeadline: "Many happy returns",
  },
  {
    id: "coral-sun",
    name: "Coral sun",
    background: ["#F2B4A6", "#E78B79"],
    ink: "#29252B",
    accent: "#FAF9F6",
    pattern: "dots",
    headlineFont: "sans",
    defaultHeadline: "Have a great one",
  },
  {
    id: "garden",
    name: "Garden green",
    background: ["#E6EEE8", "#C9DACE"],
    ink: "#26372C",
    accent: "#648B73",
    pattern: "lines",
    headlineFont: "serif",
    defaultHeadline: "Happy Anniversary",
  },
  {
    id: "midnight",
    name: "Midnight stars",
    background: ["#29252B", "#1B181D"],
    ink: "#FAF9F6",
    accent: "#E7C279",
    pattern: "stars",
    headlineFont: "serif",
    defaultHeadline: "Cheers to you",
  },
  {
    id: "paper",
    name: "Plain paper",
    background: ["#FAF9F6", "#F2EFEA"],
    ink: "#29252B",
    accent: "#E78B79",
    pattern: "none",
    headlineFont: "serif",
    defaultHeadline: "Thinking of you",
  },
];

export type CardFormat = "square" | "portrait" | "story";

export const CARD_FORMATS: Record<CardFormat, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square (posts, chats)" },
  portrait: { w: 1080, h: 1350, label: "Portrait (printable)" },
  story: { w: 1080, h: 1920, label: "Story" },
};
