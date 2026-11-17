import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Preferences as CapPreferences } from "@capacitor/preferences";
import type { BirthdayBookData, CollectionName, Preferences } from "@/types";
import { COLLECTIONS } from "@/types";
import type { StorageAdapter } from "@/services/storage/adapter";

const ROOT = "birthdaybook";

/**
 * Android/iOS storage. Each collection is a JSON document in the app's
 * private data directory (Directory.Data – excluded from other apps, kept
 * across app updates, removed only on uninstall). We deliberately avoid
 * keeping the primary copy in WebView storage, which iOS may purge under
 * storage pressure.
 *
 * Crash safety: every write goes to `<name>.json` and then to `<name>.bak.json`.
 * If the app dies mid-write, the loader falls back to the last good backup.
 * Small values (theme, scheduler bookkeeping) use Capacitor Preferences
 * (SharedPreferences / UserDefaults).
 */
export class NativeFilesystemAdapter implements StorageAdapter {
  readonly name = "native-filesystem";
  private ready: Promise<void> | null = null;

  private ensureDir() {
    if (!this.ready) {
      this.ready = Filesystem.mkdir({ path: ROOT, directory: Directory.Data, recursive: true })
        .then(() => undefined)
        .catch(() => undefined); // already exists
    }
    return this.ready;
  }

  private async readJson<T>(file: string): Promise<T | undefined> {
    for (const candidate of [`${ROOT}/${file}.json`, `${ROOT}/${file}.bak.json`]) {
      try {
        const res = await Filesystem.readFile({
          path: candidate,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        return JSON.parse(String(res.data)) as T;
      } catch {
        /* missing or corrupt – try the backup */
      }
    }
    return undefined;
  }

  private async writeJson(file: string, value: unknown) {
    await this.ensureDir();
    const data = JSON.stringify(value);
    await Filesystem.writeFile({
      path: `${ROOT}/${file}.json`,
      directory: Directory.Data,
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Filesystem.writeFile({
      path: `${ROOT}/${file}.bak.json`,
      directory: Directory.Data,
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async load(): Promise<Partial<BirthdayBookData>> {
    await this.ensureDir();
    const out: Partial<BirthdayBookData> = {};
    for (const c of COLLECTIONS) {
      const items = await this.readJson<unknown[]>(c);
      if (items) (out as Record<string, unknown>)[c] = items;
    }
    const prefs = await this.readJson<Preferences>("preferences");
    if (prefs) out.preferences = prefs;
    return out;
  }

  async saveCollection<K extends CollectionName>(name: K, items: BirthdayBookData[K]) {
    await this.writeJson(name, items);
  }

  async savePreferences(prefs: Preferences) {
    await this.writeJson("preferences", prefs);
    await CapPreferences.set({ key: "bb.theme", value: prefs.theme });
    try {
      localStorage.setItem("bb.theme", prefs.theme);
    } catch {
      /* ignore */
    }
  }

  async getMeta<T>(key: string) {
    // Large meta (snapshots) lives in files; small meta in Preferences.
    if (key.startsWith("snapshot")) return this.readJson<T>(`meta-${key}`);
    const { value } = await CapPreferences.get({ key: `bb.meta.${key}` });
    return value ? (JSON.parse(value) as T) : undefined;
  }

  async setMeta<T>(key: string, value: T) {
    if (key.startsWith("snapshot")) return this.writeJson(`meta-${key}`, value);
    await CapPreferences.set({ key: `bb.meta.${key}`, value: JSON.stringify(value) });
  }

  async deleteMeta(key: string) {
    if (key.startsWith("snapshot")) {
      for (const f of [`meta-${key}.json`, `meta-${key}.bak.json`]) {
        await Filesystem.deleteFile({ path: `${ROOT}/${f}`, directory: Directory.Data }).catch(() => undefined);
      }
      return;
    }
    await CapPreferences.remove({ key: `bb.meta.${key}` });
  }

  async clearAll() {
    await Filesystem.rmdir({ path: ROOT, directory: Directory.Data, recursive: true }).catch(() => undefined);
    this.ready = null;
    const { keys } = await CapPreferences.keys();
    for (const k of keys) if (k.startsWith("bb.")) await CapPreferences.remove({ key: k });
  }
}
