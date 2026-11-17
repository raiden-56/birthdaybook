import type { NoteKind, OccasionType, Relationship, WishChannel, WishStatus } from "@/types";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  family: "Family",
  partner: "Partner",
  friend: "Friend",
  colleague: "Colleague",
  client: "Client",
  neighbour: "Neighbour",
  other: "Other",
};

export const OCCASION_TYPE_LABEL: Record<OccasionType, string> = {
  anniversary: "Anniversary",
  wedding: "Wedding anniversary",
  "work-anniversary": "Work anniversary",
  memorial: "Remembrance",
  graduation: "Graduation",
  custom: "Custom occasion",
};

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  memory: "Memory",
  preference: "Likes & dislikes",
  conversation: "Conversation",
  idea: "Idea",
  general: "Note",
};

export const WISH_STATUS_LABEL: Record<WishStatus, string> = {
  pending: "Not yet",
  sent: "Wished",
  belated: "Wished late",
  skipped: "Missed",
};

export const WISH_CHANNEL_LABEL: Record<WishChannel, string> = {
  call: "Call",
  message: "Message",
  card: "Card",
  "in-person": "In person",
  social: "Social media",
  email: "Email",
  other: "Other",
};

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export function formatMonthDay(month: number, day: number, year?: number): string {
  return `${day} ${MONTHS[month - 1]}${year ? ` ${year}` : ""}`;
}
