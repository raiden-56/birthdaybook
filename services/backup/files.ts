import { isNative } from "@/platform";
import { downloadBlob } from "@/lib/utils";

export interface SaveResult {
  method: "download" | "file-system-access" | "native-share" | "native-documents" | "cancelled";
  location?: string;
}

/**
 * Save an exported file in the most appropriate way for the platform.
 * The original imported workbook is never overwritten: every export is a new,
 * timestamped file the user chooses where to keep.
 *
 *  - Web: File System Access "Save as" dialog where supported, otherwise a download.
 *  - Android/iOS: written to app storage, then offered through the native share
 *    sheet (Save to Files, Drive, email, WhatsApp…).
 */
export async function saveFile(
  bytes: Uint8Array | string,
  fileName: string,
  mime: string,
  opts: { preferShare?: boolean } = {},
): Promise<SaveResult> {
  if (isNative()) {
    const { saveAndShareNative } = await import("@/platform/native/files");
    return saveAndShareNative(bytes, fileName, mime, opts.preferShare ?? true);
  }
  const blob = new Blob([typeof bytes === "string" ? bytes : (bytes as BlobPart)], { type: mime });
  const w = window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  };
  if (w.showSaveFilePicker && !opts.preferShare) {
    try {
      const ext = fileName.split(".").pop() ?? "";
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: fileName, accept: { [mime]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { method: "file-system-access" };
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return { method: "cancelled" };
      // fall back to download
    }
  }
  downloadBlob(blob, fileName);
  return { method: "download" };
}

/** Web Share with files (mobile browsers). Returns false when unsupported. */
export async function shareFileWeb(bytes: Uint8Array | Blob, fileName: string, mime: string, text?: string) {
  const file = new File([bytes as BlobPart], fileName, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
