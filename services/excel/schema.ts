/**
 * Workbook layout. The same definitions drive export, the blank template and
 * the import of a BirthdayBook workbook, so a file exported on one device
 * round-trips losslessly on another.
 */

export const SHEET = {
  people: "People",
  occasions: "Occasions",
  reminders: "Reminders",
  gifts: "Gifts",
  notes: "Notes",
  preferences: "Preferences",
  wishes: "Wishes",
  checklist: "Checklist",
  readme: "Read Me",
} as const;

export interface ColumnDef {
  field: string;
  header: string;
  width?: number;
  /** Computed for readability on export, ignored on import. */
  computed?: boolean;
}

export const PEOPLE_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "firstName", header: "First Name", width: 16 },
  { field: "lastName", header: "Last Name", width: 16 },
  { field: "nickname", header: "Nickname", width: 12 },
  { field: "relationship", header: "Relationship", width: 13 },
  { field: "birthday", header: "Birthday", width: 13 },
  { field: "phone", header: "Phone", width: 16 },
  { field: "email", header: "Email", width: 24 },
  { field: "address", header: "Address", width: 28 },
  { field: "tags", header: "Tags", width: 18 },
  { field: "favorite", header: "Favorite", width: 9 },
  { field: "leapPolicy", header: "Leap Day Rule", width: 13 },
  { field: "summary", header: "Summary", width: 30 },
  { field: "archived", header: "Archived", width: 9 },
  { field: "nextBirthday", header: "Next Birthday", width: 13, computed: true },
  { field: "turning", header: "Turning", width: 8, computed: true },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const OCCASION_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "type", header: "Type", width: 16 },
  { field: "title", header: "Title", width: 26 },
  { field: "date", header: "Date", width: 13 },
  { field: "recurring", header: "Recurring", width: 10 },
  { field: "personIds", header: "People IDs", width: 30 },
  { field: "peopleNames", header: "People", width: 28, computed: true },
  { field: "notes", header: "Notes", width: 30 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const REMINDER_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "targetKind", header: "Target Type", width: 11 },
  { field: "targetId", header: "Target ID", width: 22 },
  { field: "targetName", header: "For", width: 24, computed: true },
  { field: "offsetDays", header: "Days Before", width: 11 },
  { field: "time", header: "Time", width: 8 },
  { field: "enabled", header: "Enabled", width: 9 },
  { field: "customDate", header: "Custom Date", width: 12 },
  { field: "label", header: "Label", width: 20 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const GIFT_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "personId", header: "Person ID", width: 22 },
  { field: "personName", header: "Person", width: 22, computed: true },
  { field: "title", header: "Gift", width: 26 },
  { field: "status", header: "Status", width: 11 },
  { field: "budget", header: "Budget", width: 10 },
  { field: "price", header: "Price", width: 10 },
  { field: "year", header: "Year", width: 8 },
  { field: "link", header: "Link", width: 30 },
  { field: "occasionId", header: "Occasion ID", width: 22 },
  { field: "notes", header: "Notes", width: 30 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const NOTE_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "personId", header: "Person ID", width: 22 },
  { field: "personName", header: "Person", width: 22, computed: true },
  { field: "kind", header: "Kind", width: 13 },
  { field: "date", header: "Date", width: 12 },
  { field: "text", header: "Note", width: 50 },
  { field: "pinned", header: "Pinned", width: 8 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const WISH_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "targetKind", header: "Target Type", width: 11 },
  { field: "targetId", header: "Target ID", width: 22 },
  { field: "targetName", header: "For", width: 24, computed: true },
  { field: "year", header: "Year", width: 8 },
  { field: "status", header: "Status", width: 10 },
  { field: "channel", header: "Channel", width: 11 },
  { field: "sentAt", header: "Sent At", width: 22 },
  { field: "message", header: "Message", width: 40 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

export const CHECKLIST_COLUMNS: ColumnDef[] = [
  { field: "id", header: "ID", width: 22 },
  { field: "targetKind", header: "Target Type", width: 11 },
  { field: "targetId", header: "Target ID", width: 22 },
  { field: "targetName", header: "For", width: 24, computed: true },
  { field: "year", header: "Year", width: 8 },
  { field: "text", header: "Item", width: 30 },
  { field: "done", header: "Done", width: 8 },
  { field: "order", header: "Order", width: 8 },
  { field: "createdAt", header: "Created At", width: 22 },
  { field: "updatedAt", header: "Updated At", width: 22 },
];

/** Fields the column-mapping wizard can map an arbitrary spreadsheet onto. */
export type MappableField =
  | "ignore"
  | "fullName"
  | "firstName"
  | "lastName"
  | "nickname"
  | "birthday"
  | "birthDay"
  | "birthMonth"
  | "birthYear"
  | "relationship"
  | "phone"
  | "email"
  | "address"
  | "tags"
  | "summary"
  | "favorite"
  | "id";

export const MAPPABLE_FIELDS: Array<{ field: MappableField; label: string }> = [
  { field: "ignore", label: "— Ignore column —" },
  { field: "fullName", label: "Full name" },
  { field: "firstName", label: "First name" },
  { field: "lastName", label: "Last name" },
  { field: "nickname", label: "Nickname" },
  { field: "birthday", label: "Birthday (full date)" },
  { field: "birthDay", label: "Birth day (1–31)" },
  { field: "birthMonth", label: "Birth month" },
  { field: "birthYear", label: "Birth year" },
  { field: "relationship", label: "Relationship" },
  { field: "phone", label: "Phone" },
  { field: "email", label: "Email" },
  { field: "address", label: "Address" },
  { field: "tags", label: "Tags / groups" },
  { field: "summary", label: "Notes" },
  { field: "favorite", label: "Favorite" },
  { field: "id", label: "BirthdayBook ID" },
];

const SYNONYMS: Record<Exclude<MappableField, "ignore">, string[]> = {
  id: ["id", "birthdaybook id", "record id"],
  fullName: ["name", "full name", "fullname", "contact", "contact name", "person", "display name"],
  firstName: ["first name", "firstname", "given name", "forename", "first"],
  lastName: ["last name", "lastname", "surname", "family name", "last"],
  nickname: ["nickname", "nick", "alias", "known as"],
  birthday: ["birthday", "birth date", "birthdate", "date of birth", "dob", "bday", "b-day", "born", "date"],
  birthDay: ["day", "birth day", "bday day", "dd"],
  birthMonth: ["month", "birth month", "mm"],
  birthYear: ["year", "birth year", "year of birth", "yyyy", "yob"],
  relationship: ["relationship", "relation", "relationship type", "category", "group type", "type"],
  phone: ["phone", "mobile", "cell", "phone number", "mobile number", "contact number", "whatsapp"],
  email: ["email", "e-mail", "email address", "mail"],
  address: ["address", "home address", "postal address", "city"],
  tags: ["tags", "tag", "groups", "group", "labels", "circle"],
  summary: ["notes", "note", "comments", "comment", "remarks", "summary", "description"],
  favorite: ["favorite", "favourite", "starred", "vip", "close"],
};

export function guessField(header: string): MappableField {
  const h = header.trim().toLowerCase().replace(/[_*]+/g, " ").replace(/\s+/g, " ");
  if (!h) return "ignore";
  for (const [field, words] of Object.entries(SYNONYMS)) {
    if (words.includes(h)) return field as MappableField;
  }
  for (const [field, words] of Object.entries(SYNONYMS)) {
    if (words.some((w) => w.length > 3 && h.includes(w))) return field as MappableField;
  }
  return "ignore";
}

export function guessMapping(headers: string[]): MappableField[] {
  const used = new Set<MappableField>();
  return headers.map((h) => {
    const f = guessField(h);
    if (f === "ignore" || used.has(f)) return "ignore";
    used.add(f);
    return f;
  });
}
