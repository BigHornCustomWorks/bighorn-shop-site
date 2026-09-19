import { NextResponse } from "next/server";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";
import { bumpVisit, classifySource, shopDay } from "@/lib/visit-stats";

export const runtime = "nodejs";

const COOKIE_ID = "bhcw_vid";
const COOKIE_DAY = "bhcw_day";

function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot/i.test(ua);
}

function cookieVal(header: string, name: string): string {
  const hit = header.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (isBot(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

  const body = await req.json().catch(() => ({}));
  const path = cleanStr(body.path).slice(0, 300);
  const referrer = cleanStr(body.referrer).slice(0, 500);
  const cookie = req.headers.get("cookie") || "";
  const date = shopDay();
  const seenLifetime = Boolean(cookieVal(cookie, COOKIE_ID));
  const seenToday = cookieVal(cookie, COOKIE_DAY) === date;
  const source = classifySource(referrer, path);

  const store = await readStore();
  store.stats = bumpVisit(store.stats, {
    date,
    uniqueLifetime: !seenLifetime,
    uniqueToday: !seenToday,
    source,
  });
  await writeStore(store);

  const res = NextResponse.json({
    ok: true,
    uniqueVisitors: store.stats.uniqueVisitors,
    pageViews: store.stats.pageViews,
  });
  const secure = Boolean(process.env.VERCEL);
  if (!seenLifetime) {
    res.cookies.set(COOKIE_ID, "1", { path: "/", sameSite: "lax", maxAge: 31536000, secure });
  }
  res.cookies.set(COOKIE_DAY, date, { path: "/", sameSite: "lax", maxAge: 172800, secure });
  return res;
}
