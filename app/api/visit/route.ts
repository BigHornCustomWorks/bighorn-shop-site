import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

const COOKIE = "bhcw_vid";

function isBot(ua: string): boolean {
  return /bot|crawl|spider|slurp|bingpreview|facebookexternalhit/i.test(ua);
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (isBot(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

  const cookie = req.headers.get("cookie") || "";
  const seen = cookie.split(";").some((p) => p.trim().startsWith(`${COOKIE}=`));

  const store = await readStore();
  store.stats.pageViews += 1;
  if (!seen) store.stats.uniqueVisitors += 1;
  await writeStore(store);

  const res = NextResponse.json({
    ok: true,
    uniqueVisitors: store.stats.uniqueVisitors,
    pageViews: store.stats.pageViews,
  });
  if (!seen) {
    const secure = process.env.VERCEL ? "; Secure" : "";
    res.headers.set("Set-Cookie", `${COOKIE}=1; Path=/; SameSite=Lax; Max-Age=31536000${secure}`);
  }
  return res;
}
