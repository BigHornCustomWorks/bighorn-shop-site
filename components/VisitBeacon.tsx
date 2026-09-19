"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function VisitBeacon() {
  const path = usePathname() || "/";

  useEffect(() => {
    if (path.startsWith("/master") || path.startsWith("/api")) return;
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: typeof window !== "undefined" ? window.location.pathname + window.location.search : path,
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [path]);

  return null;
}
