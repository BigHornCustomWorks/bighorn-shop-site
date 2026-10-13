import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { loadVercelTraffic } from "@/lib/vercel-analytics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const days = new URL(req.url).searchParams.get("days") === "30" ? 30 : 7;
  try {
    return NextResponse.json(await loadVercelTraffic(days));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vercel analytics did not answer.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
