export type AnalyticsLine = {
  label: string;
  visitors: number;
  pageviews: number;
};

export type VercelTraffic = {
  days: number;
  since: string;
  until: string;
  visitors: number;
  pageviews: number;
  daily: AnalyticsLine[];
  countries: AnalyticsLine[];
  referrers: AnalyticsLine[];
  pages: AnalyticsLine[];
  devices: AnalyticsLine[];
};

const PROJECT_ID = "prj_l8qrOFbiM7RZ07xeLnrM8Z0wOiDO";
const TEAM_ID = "team_43oZH9GmcD31aSfatKBlfq1R";

export function analyticsWindow(days: number, now = new Date()): { days: number; since: string; until: string } {
  const span = days === 30 ? 30 : 7;
  return {
    days: span,
    since: new Date(now.getTime() - span * 24 * 60 * 60 * 1000).toISOString(),
    until: now.toISOString(),
  };
}

export function analyticsToken(): string {
  return (
    process.env.VERCEL_ANALYTICS_TOKEN ||
    process.env.VERCEL_TOKEN ||
    process.env.VERCEL_OIDC_TOKEN ||
    ""
  ).trim();
}

function asCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function countryLabel(code: string): string {
  const raw = code.trim();
  if (!raw || raw.toLowerCase() === "others") return "Other";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(raw.toUpperCase()) || raw;
  } catch {
    return raw;
  }
}

export function referrerLabel(host: string): string {
  const raw = host.trim().toLowerCase();
  if (!raw || raw === "(direct)" || raw === "direct" || raw === "null") return "Direct";
  if (raw === "others") return "Other";
  return raw.replace(/^www\./, "");
}

export function deviceLabel(kind: string): string {
  const raw = kind.trim().toLowerCase();
  if (raw === "desktop") return "Computer";
  if (raw === "mobile") return "Phone";
  if (raw === "tablet") return "Tablet";
  if (!raw || raw === "others") return "Other";
  return kind.trim();
}

export function pageLabel(path: string): string {
  const raw = path.trim();
  if (!raw || raw.toLowerCase() === "others") return "Other";
  return raw;
}

export function dayLabel(timestamp: string): string {
  return timestamp.slice(0, 10) || "Unknown";
}

export function linesFromRows(
  data: unknown,
  key: string,
  labelOf: (raw: string) => string,
): AnalyticsLine[] {
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const src = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      label: labelOf(String(src[key] ?? "")),
      visitors: asCount(src.visitors),
      pageviews: asCount(src.pageviews),
    };
  });
}

type QueryResult = { data?: unknown };

async function vercelGet(path: string, params: Record<string, string>): Promise<QueryResult> {
  const token = analyticsToken();
  if (!token) throw new Error("The server does not have a Vercel analytics token yet.");
  const url = new URL(`https://api.vercel.com${path}`);
  url.searchParams.set("projectId", PROJECT_ID);
  url.searchParams.set("teamId", TEAM_ID);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Vercel analytics returned ${res.status}.`);
  return (await res.json()) as QueryResult;
}

const cache = new Map<number, { at: number; report: VercelTraffic }>();

export async function loadVercelTraffic(days: number, now = new Date()): Promise<VercelTraffic> {
  const window = analyticsWindow(days, now);
  const hit = cache.get(window.days);
  if (hit && now.getTime() - hit.at < 5 * 60 * 1000) return hit.report;
  const range = { since: window.since, until: window.until };
  const [totals, daily, countries, referrers, pages, devices] = await Promise.all([
    vercelGet("/v1/query/web-analytics/visits/count", range),
    vercelGet("/v1/query/web-analytics/visits/aggregate", { ...range, by: "day", limit: "31" }),
    vercelGet("/v1/query/web-analytics/visits/aggregate", { ...range, by: "country", limit: "8" }),
    vercelGet("/v1/query/web-analytics/visits/aggregate", { ...range, by: "referrerHostname", limit: "8" }),
    vercelGet("/v1/query/web-analytics/visits/aggregate", { ...range, by: "requestPath", limit: "8" }),
    vercelGet("/v1/query/web-analytics/visits/aggregate", { ...range, by: "deviceType", limit: "6" }),
  ]);
  const total = totals.data && typeof totals.data === "object" ? (totals.data as Record<string, unknown>) : {};
  const report: VercelTraffic = {
    days: window.days,
    since: window.since,
    until: window.until,
    visitors: asCount(total.visitors),
    pageviews: asCount(total.pageviews),
    daily: linesFromRows(daily.data, "timestamp", dayLabel).reverse(),
    countries: linesFromRows(countries.data, "country", countryLabel),
    referrers: linesFromRows(referrers.data, "referrerHostname", referrerLabel),
    pages: linesFromRows(pages.data, "requestPath", pageLabel),
    devices: linesFromRows(devices.data, "deviceType", deviceLabel),
  };
  cache.set(window.days, { at: now.getTime(), report });
  return report;
}
