import type {
  BirthdayBookData,
  ChecklistItem,
  CollectionName,
  Gift,
  Note,
  Occasion,
  Person,
  Preferences,
  ReminderRule,
  TargetKind,
  Wish,
} from "@/types";
import { COLLECTIONS } from "@/types";
import type { StorageAdapter } from "./adapter";
import { emptyData, normalizeData } from "./normalize";
import { nowIso, uid } from "@/lib/utils";
import { defaultRulesFor } from "@/services/reminders/planner";

type Listener = (data: BirthdayBookData) => void;
type Item<K extends CollectionName> = BirthdayBookData[K][number];

export interface Snapshot {
  id: string;
  createdAt: string;
  reason: string;
  counts: Record<string, number>;
}

const SNAPSHOT_LIMIT = 5;

/**
 * The single shared data-access layer. UI, reminder scheduler, Excel and
 * backup services all go through this repository; only the injected
 * StorageAdapter differs between web and native.
 *
 * Writes are serialised through a promise chain so two quick edits can never
 * interleave and leave a collection half-written.
 */
export class BirthdayRepository {
  private data: BirthdayBookData = emptyData();
  private listeners = new Set<Listener>();
  private writeChain: Promise<void> = Promise.resolve();
  private loaded = false;
  loadErrors: string[] = [];

  constructor(private adapter: StorageAdapter) {}

  get adapterName() {
    return this.adapter.name;
  }

  get isLoaded() {
    return this.loaded;
  }

  async init(): Promise<BirthdayBookData> {
    const raw = await this.adapter.load();
    const { data, errors } = normalizeData(raw);
    this.data = data;
    this.loadErrors = errors;
    this.loaded = true;
    this.emit();
    return this.data;
  }

  getSnapshot = (): BirthdayBookData => this.data;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const l of this.listeners) l(this.data);
  }

  /** Wait for all pending writes – used before export/backup. */
  flush(): Promise<void> {
    return this.writeChain;
  }

  private persist(collections: CollectionName[], prefs = false) {
    const snapshot = this.data;
    this.writeChain = this.writeChain
      .then(async () => {
        for (const c of collections) await this.adapter.saveCollection(c, snapshot[c]);
        if (prefs) await this.adapter.savePreferences(snapshot.preferences);
      })
      .catch((err) => {
        console.error("[BirthdayBook] write failed", err);
        throw err;
      });
    return this.writeChain;
  }

  private commit(next: BirthdayBookData, changed: CollectionName[], prefs = false) {
    this.data = next;
    this.emit();
    return this.persist(changed, prefs);
  }

  // ---------- generic CRUD ----------

  upsert<K extends CollectionName>(collection: K, item: Item<K>): Promise<void> {
    const list = this.data[collection] as Array<{ id: string }>;
    const stamped = { ...item, updatedAt: nowIso() } as Item<K> & { id: string };
    const idx = list.findIndex((x) => x.id === stamped.id);
    const nextList = idx >= 0 ? list.map((x, i) => (i === idx ? stamped : x)) : [...list, stamped];
    return this.commit({ ...this.data, [collection]: nextList }, [collection]);
  }

  remove<K extends CollectionName>(collection: K, id: string): Promise<void> {
    const list = this.data[collection] as Array<{ id: string }>;
    return this.commit({ ...this.data, [collection]: list.filter((x) => x.id !== id) }, [collection]);
  }

  // ---------- people ----------

  async addPerson(
    input: Omit<Person, "id" | "createdAt" | "updatedAt">,
    opts: { defaultReminders?: boolean } = { defaultReminders: true },
  ): Promise<Person> {
    const ts = nowIso();
    const person: Person = { ...input, id: uid("p"), createdAt: ts, updatedAt: ts };
    const rules = opts.defaultReminders
      ? defaultRulesFor("person", person.id, this.data.preferences.defaultOffsets, this.data.preferences.defaultTime, () => uid("r"))
      : [];
    await this.commit(
      { ...this.data, people: [...this.data.people, person], reminders: [...this.data.reminders, ...rules] },
      ["people", "reminders"],
    );
    return person;
  }

  updatePerson(person: Person) {
    return this.upsert("people", person);
  }

  /** Deletes a person and everything that belongs only to them. */
  deletePerson(id: string) {
    const d = this.data;
    const occasions = d.occasions.map((o) =>
      o.personIds.includes(id) ? { ...o, personIds: o.personIds.filter((x) => x !== id), updatedAt: nowIso() } : o,
    );
    return this.commit(
      {
        ...d,
        people: d.people.filter((p) => p.id !== id),
        occasions,
        reminders: d.reminders.filter((r) => !(r.targetKind === "person" && r.targetId === id)),
        gifts: d.gifts.filter((g) => g.personId !== id),
        notes: d.notes.filter((n) => n.personId !== id),
        wishes: d.wishes.filter((w) => !(w.targetKind === "person" && w.targetId === id)),
        checklist: d.checklist.filter((c) => !(c.targetKind === "person" && c.targetId === id)),
      },
      ["people", "occasions", "reminders", "gifts", "notes", "wishes", "checklist"],
    );
  }

  // ---------- occasions ----------

  async addOccasion(
    input: Omit<Occasion, "id" | "createdAt" | "updatedAt">,
    opts: { defaultReminders?: boolean } = { defaultReminders: true },
  ): Promise<Occasion> {
    const ts = nowIso();
    const occasion: Occasion = { ...input, id: uid("o"), createdAt: ts, updatedAt: ts };
    const rules = opts.defaultReminders
      ? defaultRulesFor("occasion", occasion.id, this.data.preferences.defaultOffsets, this.data.preferences.defaultTime, () => uid("r"))
      : [];
    await this.commit(
      { ...this.data, occasions: [...this.data.occasions, occasion], reminders: [...this.data.reminders, ...rules] },
      ["occasions", "reminders"],
    );
    return occasion;
  }

  deleteOccasion(id: string) {
    const d = this.data;
    return this.commit(
      {
        ...d,
        occasions: d.occasions.filter((o) => o.id !== id),
        reminders: d.reminders.filter((r) => !(r.targetKind === "occasion" && r.targetId === id)),
        wishes: d.wishes.filter((w) => !(w.targetKind === "occasion" && w.targetId === id)),
        checklist: d.checklist.filter((c) => !(c.targetKind === "occasion" && c.targetId === id)),
        gifts: d.gifts.map((g) => (g.occasionId === id ? { ...g, occasionId: undefined } : g)),
      },
      ["occasions", "reminders", "wishes", "checklist", "gifts"],
    );
  }

  // ---------- reminders ----------

  addReminder(targetKind: TargetKind, targetId: string, partial: Partial<ReminderRule> = {}) {
    const ts = nowIso();
    const rule: ReminderRule = {
      id: uid("r"),
      targetKind,
      targetId,
      offsetDays: 1,
      time: this.data.preferences.defaultTime,
      enabled: true,
      createdAt: ts,
      updatedAt: ts,
      ...partial,
    };
    return this.upsert("reminders", rule).then(() => rule);
  }

  /** Apply default reminders to every person/occasion that has none. */
  applyDefaultRemindersToAll() {
    const d = this.data;
    const has = new Set(d.reminders.map((r) => `${r.targetKind}:${r.targetId}`));
    const added: ReminderRule[] = [];
    for (const p of d.people) {
      if (!has.has(`person:${p.id}`))
        added.push(...defaultRulesFor("person", p.id, d.preferences.defaultOffsets, d.preferences.defaultTime, () => uid("r")));
    }
    for (const o of d.occasions) {
      if (!has.has(`occasion:${o.id}`))
        added.push(...defaultRulesFor("occasion", o.id, d.preferences.defaultOffsets, d.preferences.defaultTime, () => uid("r")));
    }
    if (!added.length) return Promise.resolve(0);
    return this.commit({ ...d, reminders: [...d.reminders, ...added] }, ["reminders"]).then(() => added.length);
  }

  // ---------- wishes / checklist ----------

  setWish(targetKind: TargetKind, targetId: string, year: number, patch: Partial<Wish>) {
    const existing = this.data.wishes.find(
      (w) => w.targetKind === targetKind && w.targetId === targetId && w.year === year,
    );
    const ts = nowIso();
    const wish: Wish = existing
      ? { ...existing, ...patch }
      : { id: uid("w"), targetKind, targetId, year, status: "pending", createdAt: ts, updatedAt: ts, ...patch };
    return this.upsert("wishes", wish);
  }

  ensureChecklist(targetKind: TargetKind, targetId: string, year: number, template: string[]) {
    const existing = this.data.checklist.filter(
      (c) => c.targetKind === targetKind && c.targetId === targetId && c.year === year,
    );
    if (existing.length) return Promise.resolve();
    const ts = nowIso();
    const items: ChecklistItem[] = template.map((text, order) => ({
      id: uid("c"),
      targetKind,
      targetId,
      year,
      text,
      done: false,
      order,
      createdAt: ts,
      updatedAt: ts,
    }));
    return this.commit({ ...this.data, checklist: [...this.data.checklist, ...items] }, ["checklist"]);
  }

  // ---------- gifts / notes ----------

  addGift(input: Omit<Gift, "id" | "createdAt" | "updatedAt">) {
    const ts = nowIso();
    return this.upsert("gifts", { ...input, id: uid("g"), createdAt: ts, updatedAt: ts });
  }

  addNote(input: Omit<Note, "id" | "createdAt" | "updatedAt">) {
    const ts = nowIso();
    return this.upsert("notes", { ...input, id: uid("n"), createdAt: ts, updatedAt: ts });
  }

  // ---------- preferences ----------

  setPreferences(patch: Partial<Preferences>) {
    const next = { ...this.data, preferences: { ...this.data.preferences, ...patch } };
    return this.commit(next, [], true);
  }

  // ---------- bulk operations (import / restore) ----------

  /** Replace everything. Always snapshots first so the user can undo. */
  async replaceAll(next: BirthdayBookData, reason: string) {
    await this.createSnapshot(`Before ${reason}`);
    const { data } = normalizeData(next);
    return this.commit(data, [...COLLECTIONS], true);
  }

  /** Merge rows by id (incoming wins). Snapshot first. */
  async mergeAll(incoming: Partial<BirthdayBookData>, reason: string) {
    await this.createSnapshot(`Before ${reason}`);
    const next = { ...this.data } as BirthdayBookData;
    for (const c of COLLECTIONS) {
      const rows = incoming[c] as Array<{ id: string }> | undefined;
      if (!rows?.length) continue;
      const map = new Map((next[c] as Array<{ id: string }>).map((x) => [x.id, x]));
      for (const r of rows) map.set(r.id, r);
      (next as unknown as Record<string, unknown[]>)[c] = [...map.values()];
    }
    if (incoming.preferences) next.preferences = { ...next.preferences, ...incoming.preferences };
    const { data } = normalizeData(next);
    return this.commit(data, [...COLLECTIONS], !!incoming.preferences);
  }

  /** Spreadsheet import of people. Snapshot first; optional default reminders for new rows. */
  async importPeople(add: Person[], update: Person[], withReminders: boolean) {
    await this.createSnapshot("Before Excel import");
    const d = this.data;
    const byId = new Map(d.people.map((p) => [p.id, p]));
    for (const p of update) byId.set(p.id, p);
    for (const p of add) byId.set(p.id, p);
    const rules = withReminders
      ? add.flatMap((p) => defaultRulesFor("person", p.id, d.preferences.defaultOffsets, d.preferences.defaultTime, () => uid("r")))
      : [];
    return this.commit({ ...d, people: [...byId.values()], reminders: [...d.reminders, ...rules] }, ["people", "reminders"]);
  }

  async clearEverything() {
    await this.createSnapshot("Before erase all data");
    const fresh = emptyData();
    fresh.preferences = { ...this.data.preferences };
    return this.commit(fresh, [...COLLECTIONS], true);
  }

  // ---------- local safety snapshots ----------

  async createSnapshot(reason: string): Promise<Snapshot> {
    await this.flush().catch(() => undefined);
    const index = (await this.adapter.getMeta<Snapshot[]>("snapshot-index")) ?? [];
    const snap: Snapshot = {
      id: uid("s"),
      createdAt: nowIso(),
      reason,
      counts: Object.fromEntries(COLLECTIONS.map((c) => [c, this.data[c].length])),
    };
    await this.adapter.setMeta(`snapshot-${snap.id}`, this.data);
    const next = [snap, ...index];
    for (const old of next.slice(SNAPSHOT_LIMIT)) await this.adapter.deleteMeta(`snapshot-${old.id}`);
    await this.adapter.setMeta("snapshot-index", next.slice(0, SNAPSHOT_LIMIT));
    return snap;
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return (await this.adapter.getMeta<Snapshot[]>("snapshot-index")) ?? [];
  }

  async restoreSnapshot(id: string) {
    const snap = await this.adapter.getMeta<BirthdayBookData>(`snapshot-${id}`);
    if (!snap) throw new Error("Snapshot not found");
    return this.replaceAll(snap, "restoring a snapshot");
  }

  // ---------- meta passthrough (scheduler bookkeeping) ----------

  getMeta<T>(key: string) {
    return this.adapter.getMeta<T>(key);
  }
  setMeta<T>(key: string, value: T) {
    return this.adapter.setMeta(key, value);
  }
}
