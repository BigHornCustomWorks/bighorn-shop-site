import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { collectDigitalDownloads, digitalSlugsForOrder } from "@/lib/digital-delivery";
import { sendDigitalDeliveryEmail } from "@/lib/email";
import { cleanStr } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isMaster())) {
    return NextResponse.json({ error: "Sign in to Master Control first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = cleanStr(body.orderId);
  if (!orderId) return NextResponse.json({ error: "Pick an order first." }, { status: 400 });

  const store = await readStore();
  const order = store.orders.find((row) => row.id === orderId);
  if (!order) return NextResponse.json({ error: "That order is not in the list." }, { status: 404 });
  if (!order.email.trim()) {
    return NextResponse.json({ error: "This order has no customer email." }, { status: 400 });
  }

  const slugs = digitalSlugsForOrder(order, store.products);
  const downloads = collectDigitalDownloads(slugs, store.products);
  if (!downloads.length) {
    return NextResponse.json(
      {
        error:
          "No HTTPS file links are saved on the digital items in this order. Paste the links on the product, save, then try again.",
      },
      { status: 400 },
    );
  }

  const sent = await sendDigitalDeliveryEmail({
    to: order.email,
    name: order.name,
    downloads,
    alsoPhysical: order.includesShippedGoods === true,
  });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });

  order.digitalEmailed = true;
  order.digitalEmailError = "";
  if (slugs.length) order.digitalSlugs = slugs;
  const saved = await writeStore(store);
  if (!saved.ok) {
    return NextResponse.json(
      {
        error: "The download email was sent, but the order did not save. Refresh before sending again.",
        digitalEmailed: true,
        digitalEmailError: "",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, digitalEmailed: true, digitalEmailError: "" });
}
