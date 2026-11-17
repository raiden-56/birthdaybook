import { addDays } from "date-fns";
import type { BirthdayRepository } from "@/services/storage/repository";
import type { Relationship } from "@/types";

/** Demo records spread around today so every screen has something to show. */
export async function loadSampleData(repo: BirthdayRepository) {
  const today = new Date();
  const at = (offset: number) => addDays(today, offset);
  const people: Array<[string, string, Relationship, number, number | undefined, string[], boolean]> = [
    ["Asha", "Verma", "friend", 0, 1996, ["college"], true],
    ["Ravi", "Kumar", "family", 2, 1988, ["cousins"], false],
    ["Meera", "Iyer", "colleague", 5, 1991, ["design team"], false],
    ["Kabir", "Shah", "friend", 9, 2006, ["football"], false],
    ["Nani", "Bhardwaj", "family", 16, 1951, ["family"], true],
    ["Leela", "Das", "partner", 24, 1994, [], true],
    ["Omar", "Farooq", "client", 33, 1979, ["acme"], false],
    ["Tara", "Menon", "friend", -3, 1990, ["book club"], false],
    ["Dev", "Patel", "neighbour", 47, undefined, [], false],
    ["Ira", "Kapoor", "family", 71, 2016, ["kids"], false],
    ["Sam", "Fernandes", "colleague", 120, 1985, ["ops"], false],
    ["Zoya", "Khan", "friend", 200, 2000, ["college"], false],
  ];
  const created = [];
  for (const [firstName, lastName, relationship, offset, birthYear, tags, favorite] of people) {
    const d = at(offset);
    created.push(
      await repo.addPerson({
        firstName,
        lastName,
        relationship,
        birthMonth: d.getMonth() + 1,
        birthDay: d.getDate(),
        birthYear,
        tags,
        favorite,
        archived: false,
      }),
    );
  }
  // A leap-day birthday to show the 28 Feb / 1 Mar handling.
  await repo.addPerson({ firstName: "Pari", lastName: "Joshi", relationship: "friend", birthMonth: 2, birthDay: 29, birthYear: 2004, tags: [], favorite: false, archived: false });

  const wedding = at(12);
  await repo.addOccasion({
    type: "wedding",
    title: "Ravi & Anu",
    personIds: [created[1].id],
    month: wedding.getMonth() + 1,
    day: wedding.getDate(),
    year: today.getFullYear() - 10,
    recurring: true,
  });
  const work = at(40);
  await repo.addOccasion({ type: "work-anniversary", title: "Meera joined the studio", personIds: [created[2].id], month: work.getMonth() + 1, day: work.getDate(), year: today.getFullYear() - 5, recurring: true });

  const y = today.getFullYear();
  await repo.addGift({ personId: created[0].id, title: "Sunflower print, framed", status: "purchased", budget: 2500, price: 2200, year: y });
  await repo.addGift({ personId: created[5].id, title: "Weekend in Coorg", status: "planned", budget: 18000, year: y });
  await repo.addGift({ personId: created[1].id, title: "Board game: Cascadia", status: "idea", budget: 3000, year: y });
  await repo.addNote({ personId: created[0].id, kind: "preference", text: "Loves sunflowers and filter coffee. Allergic to lilies.", date: `${y}-01-12` });
  await repo.addNote({ personId: created[4].id, kind: "memory", text: "Taught me to make mango pickle the summer of 2009.", date: `${y}-04-02` });
  await repo.addNote({ personId: created[5].id, kind: "idea", text: "Mentioned wanting to learn pottery.", date: `${y}-06-18` });
}
