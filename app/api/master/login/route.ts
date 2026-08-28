import { NextResponse } from "next/server";
import { checkPassword, makeSessionToken, passwordConfigured, sessionCookieHeader } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: "Master Control password is not set." }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookieHeader(makeSessionToken()));
  return res;
}
