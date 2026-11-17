/**
 * Sub-path the web build is served from. Empty for the Android/iOS builds and
 * for hosting at a domain root; "/birthdaybook" for GitHub Pages
 * (https://<user>.github.io/birthdaybook/). Set at build time via
 * NEXT_PUBLIC_BASE_PATH. next/link and the router add it automatically; use
 * withBase() for everything else (service worker, icons, hard navigations).
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
