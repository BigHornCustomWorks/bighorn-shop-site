import type { DayStat, ShopStats, TrafficSources } from "./types";

const TZ = "America/Denver";

export function shopDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function emptySources(): TrafficSources {
  return { facebook: 0, instagram: 0, google: 0, direct: 0, other: 0 };
}

export function emptyStats(): ShopStats {
  return { pageViews: 0, uniqueVisitors: 0, days: [], sources: emptySources() };
}

export function classifySource(referrer: string, pathAndQuery: string): keyof TrafficSources {
  const blob = `${referrer} ${pathAndQuery}`.toLowerCase();
  if (
    blob.includes("facebook.com") ||
    blob.includes("fb.com") ||
    blob.includes("fbclid") ||
    blob.includes("utm_source=facebook") ||
    blob.includes("utm_source=fb")
  ) {
    return "facebook";
  }
  if (blob.includes("instagram.com") || blob.includes("utm_source=instagram") || blob.includes("igsh")) {
    return "instagram";
  }
  if (blob.includes("google.") || blob.includes("utm_source=google") || blob.includes("bing.com")) {
    return "google";
  }
  const ref = referrer.trim();
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (host.endsWith("bighorncustomworks.com") || host.endsWith("vercel.app")) return "direct";
  } catch {
    /* ignore */
  }
  return "other";
}

export function bumpVisit(
  stats: ShopStats,
  opts: { date: string; uniqueLifetime: boolean; uniqueToday: boolean; source: keyof TrafficSources },
): ShopStats {
  const days = [...(stats.days || [])];
  const i = days.findIndex((d) => d.date === opts.date);
  const row: DayStat =
    i >= 0
      ? {
          ...days[i],
          pageViews: days[i].pageViews + 1,
          uniqueVisitors: days[i].uniqueVisitors + (opts.uniqueToday ? 1 : 0),
        }
      : { date: opts.date, pageViews: 1, uniqueVisitors: opts.uniqueToday ? 1 : 0 };
  if (i >= 0) days[i] = row;
  else days.push(row);
  days.sort((a, b) => a.date.localeCompare(b.date));

  const sources: TrafficSources = { ...emptySources(), ...(stats.sources || {}) };
  sources[opts.source] = (sources[opts.source] || 0) + 1;

  return {
    pageViews: (stats.pageViews || 0) + 1,
    uniqueVisitors: (stats.uniqueVisitors || 0) + (opts.uniqueLifetime ? 1 : 0),
    days: days.slice(-90),
    sources,
  };
}

export function sumDays(days: DayStat[], sinceDate: string): { pageViews: number; uniqueVisitors: number } {
  return days
    .filter((d) => d.date >= sinceDate)
    .reduce(
      (acc, d) => ({
        pageViews: acc.pageViews + d.pageViews,
        uniqueVisitors: acc.uniqueVisitors + d.uniqueVisitors,
      }),
      { pageViews: 0, uniqueVisitors: 0 },
    );
}

export function daysAgo(n: number): string {
  const ms = Date.now() - n * 24 * 60 * 60 * 1000;
  return shopDay(new Date(ms));
}
