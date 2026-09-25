import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import {
  blobDiagnostics,
  persistenceLabel,
  publicStore,
  readStore,
  storageIsDurable,
  stripeKeyMode,
  writeStore,
} from "@/lib/store";
import { shipFromAddress, shippoKey, shippoKeyMode } from "@/lib/shipping";
import { syncCatalogToStripe } from "@/lib/stripe-catalog";
import type { ShopOrder } from "@/lib/types";

/**
 * Label and live-rate fields are written by the server (label route, Stripe
 * webhook). A Master Control tab opened before a label was bought would
 * otherwise wipe them on its next save, and the label would look unbought.
 */
const SERVER_ORDER_FIELDS = [
  "paymentStatus",
  "shipTo",
  "rateId",
  "rateShipmentId",
  "rateCarrier",
  "rateService",
  "rateServiceToken",
  "rateCents",
  "labelRateId",
  "labelStatus",
  "labelStartedAt",
  "labelError",
  "labelUrl",
  "labelTrackingUrl",
  "labelCarrier",
  "labelService",
  "labelCents",
  "labelBoughtAt",
] as const;

function keepServerOrderFields(incoming: unknown[], current: ShopOrder[]): ShopOrder[] {
  const byId = new Map(current.map((o) => [o.id, o]));
  // Rows are normalized again in writeStore; this only carries fields across.
  return incoming.map((row) => {
    const id = row && typeof row === "object" ? (row as { id?: unknown }).id : undefined;
    const server = typeof id === "string" ? byId.get(id) : undefined;
    if (!server) return row;
    const kept: Record<string, unknown> = { ...(row as object) };
    for (const key of SERVER_ORDER_FIELDS) kept[key] = server[key];
    // A label bought server-side also filled the tracking fields.
    if (server.labelUrl && !kept.trackingNumber) {
      kept.trackingNumber = server.trackingNumber;
      kept.trackingCarrier = server.trackingCarrier;
    }
    return kept;
  }) as ShopOrder[];
}

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
    storageDurable: storageIsDurable(),
    blob: await blobDiagnostics(),
    stripeKeyMode: stripeKeyMode(store),
    envStripe: Boolean(process.env.STRIPE_SECRET_KEY),
    envResend: Boolean(process.env.RESEND_API_KEY),
    envSmtp: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    shippoMode: shippoKeyMode(shippoKey()),
    shipFromSource: shipFromAddress(store.settings)?.source || "",
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
    orders: Array.isArray(incoming.orders)
      ? keepServerOrderFields(incoming.orders, current.orders)
      : current.orders,
    products: Array.isArray(incoming.products) ? incoming.products : current.products,
    categories: Array.isArray(incoming.categories) ? incoming.categories : current.categories,
    gallery: Array.isArray(incoming.gallery) ? incoming.gallery : current.gallery,
    metalSigns: incoming.metalSigns && typeof incoming.metalSigns === "object" ? incoming.metalSigns : current.metalSigns,
    stats: current.stats,
  };
  const sync = await syncCatalogToStripe(merged, current);
  const result = await writeStore(sync.store);
  return NextResponse.json({
    ok: result.ok,
    persisted: result.persisted,
    persistence: persistenceLabel(),
    storageDurable: storageIsDurable(),
    storageError: result.error,
    stripeKeyMode: stripeKeyMode(sync.store),
    stripeSynced: sync.synced,
    stripeError: sync.error,
  });
}
