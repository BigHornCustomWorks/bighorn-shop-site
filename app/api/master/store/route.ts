import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { persistenceLabel, publicStore, readStore, writeStore } from "@/lib/store";
import { syncCatalogToStripe } from "@/lib/stripe-catalog";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const store = await readStore();
  return NextResponse.json({
    store: {
      ...store,
      settings: {
        ...store.settings,
        stripeSecretKey: store.settings.stripeSecretKey ? "•••• set in Master Control" : "",
      },
    },
    publicPreview: publicStore(store),
    persistence: persistenceLabel(),
    envStripe: Boolean(process.env.STRIPE_SECRET_KEY),
    envResend: Boolean(process.env.RESEND_API_KEY),
    envSmtp: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
}

export async function PUT(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }
  const current = await readStore();
  const incoming = body.store && typeof body.store === "object" ? body.store : body;
  const nextKey =
    incoming.settings && typeof incoming.settings.stripeSecretKey === "string"
      ? incoming.settings.stripeSecretKey
      : "";
  const merged = {
    ...current,
    ...incoming,
    settings: {
      ...current.settings,
      ...(incoming.settings || {}),
      stripeSecretKey:
        nextKey && !nextKey.includes("•") ? nextKey : current.settings.stripeSecretKey,
    },
    quotes: Array.isArray(incoming.quotes) ? incoming.quotes : current.quotes,
    orders: Array.isArray(incoming.orders) ? incoming.orders : current.orders,
    products: Array.isArray(incoming.products) ? incoming.products : current.products,
    categories: Array.isArray(incoming.categories) ? incoming.categories : current.categories,
    stats: current.stats,
  };
  const sync = await syncCatalogToStripe(merged);
  const result = await writeStore(sync.store);
  return NextResponse.json({
    ok: result.ok,
    persisted: result.persisted,
    persistence: persistenceLabel(),
    stripeSynced: sync.synced,
    stripeError: sync.error,
  });
}
