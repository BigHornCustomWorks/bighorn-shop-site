"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function VisitBeacon() {
  const path = usePathname() || "/";

  useEffect(() => {
    if (path.startsWith("/master") || path.startsWith("/api")) return;
    fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => {
      /* ignore */
    });
  }, [path]);

  return null;
}
