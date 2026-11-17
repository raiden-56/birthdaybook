import { Capacitor } from "@capacitor/core";

export type PlatformName = "web" | "android" | "ios";

export function getPlatform(): PlatformName {
  if (typeof window === "undefined") return "web";
  const p = Capacitor.getPlatform();
  return p === "android" || p === "ios" ? p : "web";
}

export function isNative(): boolean {
  return getPlatform() !== "web";
}

export const PLATFORM_LABEL: Record<PlatformName, string> = {
  web: "Web browser",
  android: "Android",
  ios: "iPhone / iPad",
};
