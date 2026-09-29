import { NextResponse } from "next/server";
import { sendShopMail } from "@/lib/email";
import { cleanMultiline, cleanStr, newId, safeUrl } from "@/lib/sanitize";
import { contactPreferenceLabel, serviceLeadText, serviceNeedLabel } from "@/lib/service-lead";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8_000_000;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

function isImage(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return IMAGE_EXT.test(file.name);
}

function fileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return safe || "photo.jpg";
}

async function storePhoto(file: File, bytes: Buffer): Promise<string> {
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`bhcw/services/${Date.now()}-${fileName(file.name)}`, bytes, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type || "application/octet-stream",
    });
    return safeUrl(blob.url);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = cleanStr(form.get("name")).slice(0, 120);
    const email = cleanStr(form.get("email")).slice(0, 160);
    const phone = cleanStr(form.get("phone")).slice(0, 40);
    const serviceType = cleanStr(form.get("serviceType"));
    const description = cleanMultiline(form.get("description")).slice(0, 4000);
    const fitNotes = cleanMultiline(form.get("fitNotes")).slice(0, 4000);
    const approxSize = cleanStr(form.get("approxSize")).slice(0, 160);
    const preferredContact = cleanStr(form.get("preferredContact"));

    if (!name || !email || !description) {
      return NextResponse.json({ error: "Name, email, and a description are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "That email does not look right." }, { status: 400 });
    }
    if (!serviceNeedLabel(serviceType)) {
      return NextResponse.json({ error: "Choose what you need." }, { status: 400 });
    }
    if (preferredContact && !contactPreferenceLabel(preferredContact)) {
      return NextResponse.json({ error: "Choose how you want to be contacted." }, { status: 400 });
    }

    const files = form
      .getAll("photos")
      .filter((file): file is File => file instanceof File && file.size > 0);
    if (files.length > MAX_PHOTOS) {
      return NextResponse.json({ error: "Send up to 3 photos." }, { status: 400 });
    }
    for (const file of files) {
      if (file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Each photo needs to be under 8 MB." }, { status: 400 });
      }
      if (!isImage(file)) {
        return NextResponse.json({ error: "Photos need to be image files." }, { status: 400 });
      }
    }

    const photoUrls: string[] = [];
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const url = await storePhoto(file, bytes);
      if (url) photoUrls.push(url);
      attachments.push({
        filename: fileName(file.name),
        content: bytes,
        contentType: file.type || "application/octet-stream",
      });
    }

    const createdAt = new Date().toISOString();
    const quote = {
      id: newId("quote"),
      name,
      email,
      phone,
      need: description,
      photoUrl: photoUrls[0] || "",
      createdAt,
      read: false,
      emailed: false,
      kind: serviceType === "sign" ? ("sign" as const) : ("general" as const),
      widthIn: 0,
      heightIn: 0,
      finishName: "",
      fulfillment: "",
      estimateLabel: "",
      sampleUrl: "",
      serviceType,
      fitNotes,
      approxSize,
      preferredContact,
      photoUrls,
    };

    const store = await readStore();
    quote.emailed = await sendShopMail({
      to: store.site.contactEmail,
      replyTo: email,
      subject: `Service request from ${name}`,
      text: serviceLeadText({
        name,
        email,
        phone,
        serviceType,
        description,
        fitNotes,
        approxSize,
        preferredContact,
        photoUrls,
        createdAt,
      }),
      attachments,
    });

    store.quotes = [quote, ...store.quotes].slice(0, 400);
    await writeStore(store);
    return NextResponse.json({ ok: true, emailed: quote.emailed });
  } catch {
    return NextResponse.json(
      { error: "Could not save the request. Email bighorncustomworks@gmail.com directly." },
      { status: 500 },
    );
  }
}
