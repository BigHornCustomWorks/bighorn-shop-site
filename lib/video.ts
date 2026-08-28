import { safeUrl } from "./sanitize";

export type MediaKind = "youtube" | "vimeo" | "file" | "unknown";

export type MediaItem = {
  src: string;
  kind: MediaKind;
  embedUrl: string;
};

function youtubeId(url: URL): string {
  if (url.hostname === "youtu.be") return url.pathname.replace(/^\//, "").split("/")[0] || "";
  if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2] || "";
  if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || "";
  return url.searchParams.get("v") || "";
}

function vimeoId(url: URL): string {
  if (url.hostname.includes("player.vimeo.com")) {
    return url.pathname.split("/").filter(Boolean).pop() || "";
  }
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[0] && /^\d+$/.test(parts[0]) ? parts[0] : "";
}

export function classifyMedia(raw: string): MediaItem | null {
  const src = safeUrl(raw);
  if (!src) return null;
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      const id = youtubeId(url).replace(/[^a-zA-Z0-9_-]/g, "");
      if (!id) return null;
      return {
        src,
        kind: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = vimeoId(url).replace(/\D/g, "");
      if (!id) return null;
      return {
        src,
        kind: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}`,
      };
    }
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url.pathname)) {
      return { src, kind: "file", embedUrl: src };
    }
    return { src, kind: "unknown", embedUrl: src };
  } catch {
    return null;
  }
}

export function mediaList(urls: string[]): MediaItem[] {
  return urls.map(classifyMedia).filter((m): m is MediaItem => Boolean(m));
}
