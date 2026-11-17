import { openDB, type IDBPDatabase } from "idb";
import type { BirthdayBookData, CollectionName, Preferences } from "@/types";
import { COLLECTIONS } from "@/types";
import type { StorageAdapter } from "@/services/storage/adapter";

const DB_NAME = "birthdaybook";
const DB_VERSION = 1;

/**
 * Web storage: one IndexedDB object store per collection plus a `meta` store.
 * Collections are written as whole arrays inside a single transaction so a
 * collection is never half-written.
 */
export class IndexedDbAdapter implements StorageAdapter {
  readonly name = "indexeddb";
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private db() {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          for (const c of COLLECTIONS) {
            if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
        },
      });
      // Ask the browser not to evict our data under storage pressure.
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => undefined);
      }
    }
    return this.dbPromise;
  }

  async load(): Promise<Partial<BirthdayBookData>> {
    const db = await this.db();
    const out: Partial<BirthdayBookData> = {};
    for (const c of COLLECTIONS) {
      (out as Record<string, unknown>)[c] = await db.getAll(c);
    }
    const prefs = await db.get("meta", "preferences");
    if (prefs) out.preferences = prefs as Preferences;
    return out;
  }

  async saveCollection<K extends CollectionName>(name: K, items: BirthdayBookData[K]) {
    const db = await this.db();
    const tx = db.transaction(name, "readwrite");
    await tx.store.clear();
    for (const item of items as Array<{ id: string }>) await tx.store.put(item);
    await tx.done;
  }

  async savePreferences(prefs: Preferences) {
    const db = await this.db();
    await db.put("meta", prefs, "preferences");
    try {
      // Lightweight mirror so the theme can be applied before React hydrates.
      localStorage.setItem("bb.theme", prefs.theme);
    } catch {
      /* private mode */
    }
  }

  async getMeta<T>(key: string) {
    const db = await this.db();
    return (await db.get("meta", key)) as T | undefined;
  }

  async setMeta<T>(key: string, value: T) {
    const db = await this.db();
    await db.put("meta", value, key);
  }

  async deleteMeta(key: string) {
    const db = await this.db();
    await db.delete("meta", key);
  }

  async clearAll() {
    const db = await this.db();
    for (const c of COLLECTIONS) await db.clear(c);
    await db.clear("meta");
  }
}
