import type { BirthdayBookData, CollectionName, Preferences } from "@/types";

/**
 * Storage adapter contract. The repository only talks to this interface, so
 * the same business logic runs on the web (IndexedDB) and on Android/iOS
 * (files in the app's private data directory via Capacitor Filesystem).
 */
export interface StorageAdapter {
  readonly name: string;
  load(): Promise<Partial<BirthdayBookData>>;
  saveCollection<K extends CollectionName>(name: K, items: BirthdayBookData[K]): Promise<void>;
  savePreferences(prefs: Preferences): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
  deleteMeta(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

/** In-memory adapter used for tests and as a last-resort fallback. */
export class MemoryAdapter implements StorageAdapter {
  readonly name = "memory";
  private data: Partial<BirthdayBookData> = {};
  private meta = new Map<string, unknown>();

  async load() {
    return structuredClone(this.data);
  }
  async saveCollection<K extends CollectionName>(name: K, items: BirthdayBookData[K]) {
    (this.data as Record<string, unknown>)[name] = structuredClone(items);
  }
  async savePreferences(prefs: Preferences) {
    this.data.preferences = structuredClone(prefs);
  }
  async getMeta<T>(key: string) {
    return this.meta.get(key) as T | undefined;
  }
  async setMeta<T>(key: string, value: T) {
    this.meta.set(key, structuredClone(value));
  }
  async deleteMeta(key: string) {
    this.meta.delete(key);
  }
  async clearAll() {
    this.data = {};
    this.meta.clear();
  }
}
