/**
 * Anything routed through a Vercel serverless function is capped at a 4.5 MB
 * request body by the platform, before our own code ever sees it. Client
 * uploads go browser -> Blob directly and skip that ceiling entirely, so the
 * two paths have very different limits.
 */
export const SERVER_UPLOAD_MAX = 4_500_000;

export const PHOTO_MAX = 25_000_000;
export const VIDEO_MAX = 200_000_000;
/** STL, 3MF, STEP, and zip. Emailed as a download link, not attached. */
export const FILE_MAX = 100_000_000;

const DOWNLOAD_EXT = new Set(["stl", "3mf", "step", "stp", "zip"]);

export const DOWNLOAD_TYPES = [
  "model/stl",
  "model/3mf",
  "model/step",
  "application/step",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];

export function maxForKind(kind: string): number {
  if (kind === "video") return VIDEO_MAX;
  if (kind === "download") return FILE_MAX;
  return PHOTO_MAX;
}

/** Last extension of a print file, or "" when it is not one we store. */
export function downloadExtension(name: string): string {
  const base = name.trim().split(/[/\\?#]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = base.slice(dot + 1).toLowerCase();
  return DOWNLOAD_EXT.has(ext) ? ext : "";
}

export function isDownloadFileName(name: string): boolean {
  return Boolean(downloadExtension(name));
}

/** Content type we send for a print file. Empty when the name is not allowed. */
export function downloadContentType(name: string): string {
  const ext = downloadExtension(name);
  if (ext === "zip") return "application/zip";
  if (ext === "stl") return "model/stl";
  if (ext === "3mf") return "model/3mf";
  if (ext === "step" || ext === "stp") return "model/step";
  return "";
}

export function humanSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${Math.round(bytes / 100_000) / 10}MB`;
  return `${Math.round(bytes / 1000)}KB`;
}

/** Blob object keys: keep them boring so nothing downstream has to escape them. */
export function safeUploadName(name: string, fallback: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  // "///" sanitises to "___", which is truthy but meaningless as a filename,
  // so require at least one real character before trusting it.
  return /[a-zA-Z0-9]/.test(cleaned) ? cleaned : fallback;
}
