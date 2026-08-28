import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { safeUrl } from "@/lib/sanitize";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }
  if (file.size > 12_000_000) {
    return NextResponse.json({ error: "File too large (12MB max)." }, { status: 400 });
  }
  try {
    const { put } = await import("@vercel/blob");
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo.jpg";
    const blob = await put(`bhcw/photos/${Date.now()}-${safe}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return NextResponse.json({ url: safeUrl(blob.url) });
  } catch {
    return NextResponse.json(
      { error: "Photo upload needs Vercel Blob. Paste an image URL instead." },
      { status: 500 },
    );
  }
}
