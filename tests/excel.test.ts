import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { excelSerialToParts, parseDateValue } from "@/services/excel/dates";
import { buildWorkbook, exportXlsx, readWorkbook, blankTemplate } from "@/services/excel/workbook";
import { analyzePeopleSheet, applyPeoplePreview, mapRelationship, parseBirthdayBookWorkbook } from "@/services/excel/importer";
import { guessMapping } from "@/services/excel/schema";
import { parseBackup, serializeBackup } from "@/services/backup/backup";
import { buildIcs } from "@/services/calendar/ics";
import { data, person, rule } from "./helpers";

const toBuffer = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

describe("date parsing", () => {
  it.each([
    ["1990-03-14", { year: 1990, month: 3, day: 14 }],
    ["14/03/1990", { year: 1990, month: 3, day: 14 }],
    ["14.03.90", { year: 1990, month: 3, day: 14 }],
    ["14 March 1990", { year: 1990, month: 3, day: 14 }],
    ["March 14, 1990", { year: 1990, month: 3, day: 14 }],
    ["14-Mar", { month: 3, day: 14, year: undefined }],
    ["--03-14", { month: 3, day: 14 }],
    ["14/03", { month: 3, day: 14 }],
  ])("parses %s", (input, expected) => {
    expect(parseDateValue(input, "DMY")).toEqual(expected);
  });

  it("uses MDY order when configured", () => {
    expect(parseDateValue("03/04/1990", "MDY")).toEqual({ year: 1990, month: 3, day: 4 });
    expect(parseDateValue("03/04/1990", "DMY")).toEqual({ year: 1990, month: 4, day: 3 });
  });

  it("auto-swaps unambiguous day/month", () => {
    expect(parseDateValue("12/25/1990", "DMY")).toEqual({ year: 1990, month: 12, day: 25 });
  });

  it("rejects impossible dates", () => {
    expect(parseDateValue("31/02/1990")).toBeUndefined();
    expect(parseDateValue("29/02/2023")).toBeUndefined();
    expect(parseDateValue("not a date")).toBeUndefined();
  });

  it("converts Excel serials without timezone drift", () => {
    expect(excelSerialToParts(32946)).toEqual({ year: 1990, month: 3, day: 14 });
    expect(excelSerialToParts(36585)).toEqual({ year: 2000, month: 2, day: 29 });
    expect(excelSerialToParts(1)).toEqual({ year: 1900, month: 1, day: 1 });
  });
});

describe("column mapping", () => {
  it("guesses common headers", () => {
    expect(guessMapping(["Name", "DOB", "Mobile", "Relation", "Random"])).toEqual([
      "fullName",
      "birthday",
      "phone",
      "relationship",
      "ignore",
    ]);
  });

  it("maps relationship synonyms", () => {
    expect(mapRelationship("Mom")).toBe("family");
    expect(mapRelationship("wife")).toBe("partner");
    expect(mapRelationship("Co-worker")).toBe("colleague");
    expect(mapRelationship("")).toBe("friend");
    expect(mapRelationship("pilot")).toBe("other");
  });
});

describe("arbitrary spreadsheet import", () => {
  function makeSheet(rows: unknown[][]) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Mark one cell as a real Excel date.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return readWorkbook(bytes, "contacts.xlsx");
  }

  it("previews rows with validation, duplicates and errors", () => {
    const existing = [person({ id: "x", firstName: "Asha", lastName: "Verma", birthMonth: 3, birthDay: 14 })];
    const wb = makeSheet([
      ["Name", "DOB", "Relation", "Email"],
      ["Asha Verma", "14/03/1992", "friend", "asha@example.com"],
      ["Ravi Kumar", "1988-07-02", "brother", "bad-email"],
      ["", "1988-07-02", "", ""],
      ["Meera", "31/02/1990", "", ""],
      ["Kiran Rao", "--12-01", "Colleague", ""],
    ]);
    const sheet = wb.sheets[0];
    const mapping = guessMapping(sheet.headers);
    const rows = analyzePeopleSheet(sheet, mapping, existing, "DMY");
    expect(rows).toHaveLength(5);
    expect(rows[0].duplicateOfId).toBe("x");
    expect(rows[1].person?.relationship).toBe("family");
    expect(rows[1].warnings).toContain("Email looks invalid");
    expect(rows[2].errors).toContain("Missing name");
    expect(rows[3].errors[0]).toMatch(/Unrecognised birthday/);
    expect(rows[4].person?.birthYear).toBeUndefined();
    expect(rows[4].row).toBe(6);

    const skip = applyPeoplePreview(rows, existing, "skip");
    expect(skip.add).toHaveLength(2);
    expect(skip.update).toHaveLength(0);
    expect(skip.skipped).toBe(3);

    const upd = applyPeoplePreview(rows, existing, "update");
    expect(upd.update).toHaveLength(1);
    expect(upd.update[0].id).toBe("x");
    expect(upd.update[0].email).toBe("asha@example.com");
    expect(upd.update[0].birthYear).toBe(1992);
  });

  it("reads real Excel date cells", () => {
    const ws = XLSX.utils.aoa_to_sheet([["Name", "Birthday"], ["Leap Person", new Date(Date.UTC(2000, 1, 29))]], { cellDates: true, dateNF: "yyyy-mm-dd" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const bytes = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const read = readWorkbook(bytes, "s.xlsx");
    const rows = analyzePeopleSheet(read.sheets[0], guessMapping(read.sheets[0].headers), [], "DMY");
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].person).toMatchObject({ birthMonth: 2, birthDay: 29, birthYear: 2000 });
  });

  it("imports CSV", () => {
    const csv = "First Name,Last Name,Birthday\nAnil,Shah,05/09/1975\n";
    const read = readWorkbook(new TextEncoder().encode(csv).buffer as ArrayBuffer, "people.csv");
    const rows = analyzePeopleSheet(read.sheets[0], guessMapping(read.sheets[0].headers), [], "DMY");
    expect(rows[0].person).toMatchObject({ firstName: "Anil", lastName: "Shah", birthMonth: 9, birthDay: 5, birthYear: 1975 });
  });
});

describe("full workbook round trip", () => {
  const source = data({
    people: [
      person({ id: "a", firstName: "Asha", lastName: "Verma", birthYear: 1992, tags: ["college", "close"], favorite: true, phone: "+91 98765 43210" }),
      person({ id: "b", firstName: "Leap", lastName: "Day", birthMonth: 2, birthDay: 29, birthYear: 2000, leapPolicy: "mar1" }),
      person({ id: "c", firstName: "No", lastName: "Year", birthMonth: 12, birthDay: 31 }),
    ],
    occasions: [
      {
        id: "o1",
        type: "wedding",
        title: "Asha & Dev",
        personIds: ["a"],
        month: 6,
        day: 21,
        year: 2020,
        recurring: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    reminders: [rule("a", 7), rule("a", 0, { time: "08:30" }), { ...rule("o1", 1), targetKind: "occasion" }],
    gifts: [{ id: "g1", personId: "a", title: "Sunflower print", status: "purchased", budget: 2000, price: 1800, year: 2026, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    notes: [{ id: "n1", personId: "a", kind: "preference", text: "Allergic to lilies", date: "2026-02-01", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    wishes: [{ id: "w1", targetKind: "person", targetId: "a", year: 2026, status: "sent", channel: "call", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    checklist: [{ id: "c1", targetKind: "person", targetId: "a", year: 2026, text: "Book table", done: true, order: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  });

  it("has all required worksheets", () => {
    const wb = buildWorkbook(source);
    for (const name of ["People", "Occasions", "Reminders", "Gifts", "Notes", "Preferences"]) {
      expect(wb.SheetNames).toContain(name);
    }
  });

  it("exports and re-imports without losing records", () => {
    const bytes = exportXlsx(source);
    const read = readWorkbook(toBuffer(bytes), "export.xlsx");
    expect(read.isBirthdayBook).toBe(true);
    const { data: back, errors } = parseBirthdayBookWorkbook(read, "DMY");
    expect(errors).toEqual([]);
    expect(back.people).toHaveLength(3);
    expect(back.people!.find((p) => p.id === "a")).toMatchObject({
      firstName: "Asha",
      birthYear: 1992,
      tags: ["college", "close"],
      favorite: true,
      phone: "+91 98765 43210",
    });
    expect(back.people!.find((p) => p.id === "b")).toMatchObject({ birthMonth: 2, birthDay: 29, leapPolicy: "mar1" });
    expect(back.people!.find((p) => p.id === "c")?.birthYear).toBeUndefined();
    expect(back.occasions![0]).toMatchObject({ id: "o1", type: "wedding", year: 2020, recurring: true, personIds: ["a"] });
    expect(back.reminders).toHaveLength(3);
    expect(back.reminders!.find((r) => r.offsetDays === 0)?.time).toBe("08:30");
    expect(back.gifts![0]).toMatchObject({ title: "Sunflower print", price: 1800, status: "purchased" });
    expect(back.notes![0].text).toBe("Allergic to lilies");
    expect(back.wishes![0]).toMatchObject({ status: "sent", channel: "call" });
    expect(back.checklist![0]).toMatchObject({ text: "Book table", done: true });
    expect(back.preferences?.leapPolicy).toBe("feb28");
  });

  it("produces a readable blank template", () => {
    const read = readWorkbook(toBuffer(blankTemplate()), "template.xlsx");
    expect(read.isBirthdayBook).toBe(true);
    const { data: back } = parseBirthdayBookWorkbook(read, "DMY");
    expect(back.people).toHaveLength(1);
  });
});

describe("backup", () => {
  it("round-trips JSON backups", () => {
    const d = data({ people: [person({ id: "a" })], reminders: [rule("a", 1)] });
    const parsed = parseBackup(serializeBackup(d));
    expect(parsed.data.people).toHaveLength(1);
    expect(parsed.data.reminders).toHaveLength(1);
    expect(parsed.errors).toEqual([]);
  });

  it("rejects non-backups and drops orphans", () => {
    expect(() => parseBackup("{}")).toThrow();
    expect(() => parseBackup("nope")).toThrow();
    const parsed = parseBackup(JSON.stringify({ people: [], reminders: [rule("ghost", 1)] }));
    expect(parsed.data.reminders).toHaveLength(0);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});

describe("ics export", () => {
  it("creates yearly all-day events with alarms", () => {
    const d = data({ people: [person({ id: "a", firstName: "Asha", birthYear: 1992 })], reminders: [rule("a", 1, { time: "09:00" })] });
    const ics = buildIcs(d);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=YEARLY");
    expect(ics).toContain("DTSTART;VALUE=DATE:19920314");
    expect(ics).toContain("TRIGGER;RELATED=START:-P0DT15H0M".replace("P0D", "P"));
  });

  it("moves 29 Feb birthdays to an observed day so they recur yearly", () => {
    const d = data({ people: [person({ id: "l", birthMonth: 2, birthDay: 29, birthYear: 2000 })] });
    expect(buildIcs(d)).toContain("DTSTART;VALUE=DATE:20000228");
  });
});
