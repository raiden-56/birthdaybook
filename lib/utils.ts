export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function uid(prefix = ""): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * FNV-1a hash reduced to a positive signed 32-bit integer (1..2^31-1).
 * Android notification IDs must fit in a Java int; iOS accepts strings but we
 * use the same numbers everywhere so pending notifications can be matched.
 */
export function stableNotificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const id = (h >>> 0) & 0x7fffffff;
  return id === 0 ? 1 : id;
}

/** Short content hash used to detect "schedule needs refreshing". */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function fullName(p: { firstName: string; lastName?: string }): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function initials(p: { firstName: string; lastName?: string }): string {
  const a = p.firstName?.[0] ?? "";
  const b = p.lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatMoney(value: number | undefined, currency: string): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Avatar tint derived from the person id so it is stable across sessions. */
export function avatarTone(id: string): string {
  const tones = ["tone-plum", "tone-coral", "tone-green", "tone-lavender", "tone-sand"];
  return tones[stableNotificationId(id) % tones.length];
}
