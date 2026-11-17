import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { SaveResult } from "@/services/backup/files";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Native export: always keeps a copy in the app's Documents folder
 * (visible in the iOS Files app thanks to UIFileSharingEnabled, and in
 * Android's app-specific storage), then opens the share sheet so the user can
 * send it to Files, Drive, email or another device.
 */
export async function saveAndShareNative(
  bytes: Uint8Array | string,
  fileName: string,
  _mime: string,
  share: boolean,
): Promise<SaveResult> {
  const isText = typeof bytes === "string";
  const write = (directory: Directory, path: string) =>
    Filesystem.writeFile({
      path,
      directory,
      recursive: true,
      ...(isText ? { data: bytes as string, encoding: Encoding.UTF8 } : { data: toBase64(bytes as Uint8Array) }),
    });

  let location: string | undefined;
  try {
    const res = await write(Directory.Documents, `BirthdayBook/${fileName}`);
    location = res.uri;
  } catch {
    // Some Android versions restrict public Documents; fall back to app cache.
  }
  if (!share) return { method: "native-documents", location };

  const cached = await write(Directory.Cache, `exports/${fileName}`);
  try {
    await Share.share({ title: fileName, files: [cached.uri], dialogTitle: "Save or share your BirthdayBook file" });
    return { method: "native-share", location: location ?? cached.uri };
  } catch {
    // User dismissed the share sheet – the Documents copy still exists.
    return { method: location ? "native-documents" : "cancelled", location };
  }
}

export async function shareImageNative(dataUrl: string, fileName: string, text?: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const res = await Filesystem.writeFile({ path: `cards/${fileName}`, directory: Directory.Cache, data: base64, recursive: true });
  await Share.share({ files: [res.uri], text, dialogTitle: "Share card" });
}

export async function shareTextNative(text: string, title?: string) {
  await Share.share({ text, title, dialogTitle: title ?? "Share" });
}
