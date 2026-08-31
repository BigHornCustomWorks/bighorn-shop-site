/**
 * Anything routed through a Vercel serverless function is capped at a 4.5 MB
 * request body by the platform, before our own code ever sees it. Client
 * uploads go browser -> Blob directly and skip that ceiling entirely, so the
 * two paths have very different limits.
 */
export const SERVER_UPLOAD_MAX = 4_500_000;

export const PHOTO_MAX = 25_000_000;
export const VIDEO_MAX = 200_000_000;

export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];

export function maxForKind(kind: string): number {
  return kind === "video" ? VIDEO_MAX : PHOTO_MAX;
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
