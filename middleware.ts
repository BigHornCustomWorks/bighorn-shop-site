import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function valid(token: string | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return Boolean(parts[0] && parts[1] && parts[2] && parts[2].length === 64);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/master/login" || path.startsWith("/api/master/login")) return NextResponse.next();
  if (path.startsWith("/master") || (path.startsWith("/api/master") && path !== "/api/master/login")) {
    const token = req.cookies.get("bhcw_master")?.value;
    if (!valid(token, process.env.MASTER_SESSION_SECRET || "")) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "auth" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/master/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/master/:path*", "/api/master/:path*"],
};
