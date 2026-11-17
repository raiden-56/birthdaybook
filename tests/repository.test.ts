import { describe, expect, it } from "vitest";
import { BirthdayRepository } from "@/services/storage/repository";
import { MemoryAdapter } from "@/services/storage/adapter";
import { person } from "./helpers";

const base = { firstName: "Asha", lastName: "Verma", relationship: "friend" as const, birthMonth: 3, birthDay: 14, tags: [], favorite: false };

describe("BirthdayRepository", () => {
  it("persists through the adapter and reloads", async () => {
    const adapter = new MemoryAdapter();
    const repo = new BirthdayRepository(adapter);
    await repo.init();
    await repo.addPerson(base);
    await repo.flush();
    const again = new BirthdayRepository(adapter);
    await again.init();
    expect(again.getSnapshot().people).toHaveLength(1);
    expect(again.getSnapshot().reminders).toHaveLength(4); // default 7/3/1/0
  });

  it("cascades person deletes to linked records", async () => {
    const repo = new BirthdayRepository(new MemoryAdapter());
    await repo.init();
    const p = await repo.addPerson(base);
    await repo.addGift({ personId: p.id, title: "Book", status: "idea", year: 2026 });
    await repo.addNote({ personId: p.id, kind: "memory", text: "x", date: "2026-01-01" });
    await repo.setWish("person", p.id, 2026, { status: "sent" });
    await repo.deletePerson(p.id);
    const d = repo.getSnapshot();
    expect([d.people, d.reminders, d.gifts, d.notes, d.wishes].map((x) => x.length)).toEqual([0, 0, 0, 0, 0]);
  });

  it("snapshots before an import and can restore it", async () => {
    const repo = new BirthdayRepository(new MemoryAdapter());
    await repo.init();
    await repo.addPerson(base);
    await repo.importPeople([person({ id: "new1" }), person({ id: "new2" })], [], false);
    expect(repo.getSnapshot().people).toHaveLength(3);
    const [snap] = await repo.listSnapshots();
    expect(snap.reason).toBe("Before Excel import");
    await repo.restoreSnapshot(snap.id);
    expect(repo.getSnapshot().people).toHaveLength(1);
    // Restoring itself took a snapshot, so the import can be redone.
    expect((await repo.listSnapshots()).length).toBe(2);
  });

  it("keeps at most five snapshots", async () => {
    const repo = new BirthdayRepository(new MemoryAdapter());
    await repo.init();
    for (let i = 0; i < 8; i++) await repo.createSnapshot(`s${i}`);
    const list = await repo.listSnapshots();
    expect(list).toHaveLength(5);
    expect(list[0].reason).toBe("s7");
  });
});
