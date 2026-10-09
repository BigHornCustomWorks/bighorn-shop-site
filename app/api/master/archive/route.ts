import { NextResponse } from "next/server";
import { isArchiveKind } from "@/lib/archive";
import { isMaster } from "@/lib/auth";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";
import type { PaymentQuote, Quote, ShopOrder, ShopStore } from "@/lib/types";

export const runtime = "nodejs";

function stampRow<T extends { id: string; archivedAt?: string }>(rows: T[], id: string, archivedAt: string): boolean {
  const row = rows.find((item) => item.id === id);
  if (!row) return false;
  row.archivedAt = archivedAt;
  return true;
}

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { kind?: unknown; id?: unknown; archived?: unknown } | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }
  if (!isArchiveKind(body.kind)) {
    return NextResponse.json({ error: "Unknown archive kind." }, { status: 400 });
  }
  const id = cleanStr(body.id).slice(0, 80);
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const store = await readStore();
  const archivedAt = body.archived === true ? new Date().toISOString() : "";
  const updated = applyStamp(store, body.kind, id, archivedAt);
  if (!updated) return NextResponse.json({ error: "That was not found." }, { status: 404 });

  const saved = await writeStore(store);
  if (!saved.ok) return NextResponse.json({ error: "Could not save that." }, { status: 500 });
  return NextResponse.json({ ok: true, archivedAt });
}

function applyStamp(store: ShopStore, kind: "order" | "quote" | "payment", id: string, archivedAt: string): boolean {
  if (kind === "order") return stampRow<ShopOrder>(store.orders || [], id, archivedAt);
  if (kind === "quote") return stampRow<Quote>(store.quotes || [], id, archivedAt);
  return stampRow<PaymentQuote>(store.paymentQuotes || [], id, archivedAt);
}
