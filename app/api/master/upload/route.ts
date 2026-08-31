import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isMaster } from "@/lib/auth";
import { safeUrl } from "@/lib/sanitize";
import { SERVER_UPLOAD_MAX, humanSize } from "@/lib/uploadLimits";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Fallback path only. Master Control uploads straight to Blob from the browser
 * via /api/blob-upload; this route is for local development and for when that
 * fails. Everything here passes through a serverless function, so the platform
 * caps it at 4.5 MB regardless of what we would prefer.
 */

function safeName(name: string, fallback: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || fallback;
}

async function saveLocal(kind: string, file: File, filename: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);
  return `/uploads/${filename}`;
}

export async function POST(req: Request) {
  if (!(await isMaster())) return NextResponse.json({ error: "auth" }, { status: 401 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Upload was cut off. This backup route is limited to " +
          humanSize(SERVER_UPLOAD_MAX) +
          " — reload Master Control so it uploads straight to storage instead.",
      },
      { status: 413 },
    );
  }
  const file = form.get("file");
  const kind = String(form.get("kind") || "photo") === "video" ? "video" : "photo";
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "No file." }, { status: 400 });
  }
  if (file.size > SERVER_UPLOAD_MAX) {
    return NextResponse.json(
      {
        error:
          "That file is " +
          humanSize(file.size) +
          ". This backup route caps at " +
          humanSize(SERVER_UPLOAD_MAX) +
          " — reload Master Control so it uploads straight to storage instead.",
      },
      { status: 400 },
    );
  }
  if (kind === "video" && !file.type.startsWith("video/") && !/\.(mp4|webm|mov|ogg)$/i.test(file.name)) {
    return NextResponse.json({ error: "Pick a video file (mp4, webm, mov)." }, { status: 400 });
  }

  const filename = `${Date.now()}-${safeName(file.name, kind === "video" ? "clip.mp4" : "photo.jpg")}`;

  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`bhcw/${kind}s/${filename}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    const url = safeUrl(blob.url);
    if (url) return NextResponse.json({ url });
  } catch {
    /* fall through to local disk (works on this computer) */
  }

  try {
    const url = await saveLocal(kind, file, filename);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "Upload failed. Paste a URL instead, or check disk permissions." },
      { status: 500 },
    );
  }
}
