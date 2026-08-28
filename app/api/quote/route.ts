import { NextResponse } from "next/server";
import { sendQuoteEmail } from "@/lib/email";
import { cleanMultiline, cleanStr, newId, safeUrl } from "@/lib/sanitize";
import { readStore, writeStore } from "@/lib/store";

export const runtime = "nodejs";

async function maybeUpload(file: File | null): Promise<string> {
  if (!file || !file.size) return "";
  if (file.size > 8_000_000) return "";
  try {
    const { put } = await import("@vercel/blob");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo.jpg";
    const blob = await put(`bhcw/quotes/${Date.now()}-${safe}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return safeUrl(blob.url);
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = cleanStr(form.get("name"));
    const email = cleanStr(form.get("email"));
    const phone = cleanStr(form.get("phone"));
    const need = cleanMultiline(form.get("need"));
    if (!name || !email || !need) {
      return NextResponse.json({ error: "Name, email, and what you need are required." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "That email does not look right." }, { status: 400 });
    }

    const photo = form.get("photo");
    const photoUrl = await maybeUpload(photo instanceof File ? photo : null);

    const quote = {
      id: newId("quote"),
      name,
      email,
      phone,
      need,
      photoUrl,
      createdAt: new Date().toISOString(),
      read: false,
      emailed: false,
    };

    const store = await readStore();
    const emailed = await sendQuoteEmail(quote, store.site.contactEmail);
    quote.emailed = emailed;

    store.quotes = [quote, ...store.quotes].slice(0, 400);
    await writeStore(store);

    return NextResponse.json({ ok: true, emailed });
  } catch {
    return NextResponse.json(
      { error: "Could not save the quote. Email bighorncustomworks@gmail.com directly." },
      { status: 500 },
    );
  }
}
