import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isMaster } from "@/lib/auth";
import {
  DOWNLOAD_TYPES,
  FILE_MAX,
  PHOTO_MAX,
  PHOTO_TYPES,
  VIDEO_MAX,
  VIDEO_TYPES,
  isDownloadFileName,
} from "@/lib/uploadLimits";
import { mediaObjectKey, r2Configured, r2PresignPut } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * Issues short-lived credentials so the browser can upload straight to storage
 * (R2 preferred, else Vercel Blob), bypassing the 4.5 MB serverless body cap.
 *
 * R2 path: POST JSON { mode:"presign", kind, filename, contentType } →
 *   { uploadUrl, publicUrl, key } for a browser PUT.
 * Blob path: unchanged @vercel/blob/client handleUpload protocol.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  // --- Cloudflare R2 presign (preferred when configured) ---
  if (r2Configured() && (body.mode === "presign" || body.type === "r2-presign")) {
    if (!(await isMaster())) {
      return NextResponse.json({ error: "Not signed in to Master Control." }, { status: 401 });
    }
    const kind = body.kind === "video" || body.kind === "download" ? body.kind : "photo";
    const filename = String(body.filename || (kind === "video" ? "clip.mp4" : kind === "download" ? "file.zip" : "photo.jpg"));
    const contentType = String(body.contentType || "application/octet-stream");
    if (kind === "download" && !isDownloadFileName(filename)) {
      return NextResponse.json({ error: "Upload an STL, 3MF, STEP, or zip file." }, { status: 400 });
    }
    const folder = kind === "download" ? "downloads" : `${kind}s`;
    const key = mediaObjectKey(folder, filename);
    const max =
      kind === "download" ? FILE_MAX : kind === "video" ? VIDEO_MAX : PHOTO_MAX;
    const size = Number(body.size || 0);
    if (size > max) {
      return NextResponse.json({ error: "File too large for this upload type." }, { status: 400 });
    }
    const signed = await r2PresignPut(key, contentType);
    if (!signed.ok) {
      return NextResponse.json({ error: signed.error }, { status: 500 });
    }
    return NextResponse.json({
      backend: "r2",
      uploadUrl: signed.uploadUrl,
      publicUrl: signed.publicUrl,
      key: signed.key,
    });
  }

  if (r2Configured() && body.mode === "status") {
    return NextResponse.json({ backend: "r2" });
  }

  // --- Legacy Vercel Blob client upload ---
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "No durable upload backend. Set R2_* env vars (preferred) or BLOB_READ_WRITE_TOKEN." },
      { status: 500 },
    );
  }

  try {
    const result = await handleUpload({
      body: body as unknown as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!(await isMaster())) throw new Error("Not signed in to Master Control.");
        if (clientPayload === "download") {
          if (!isDownloadFileName(_pathname)) {
            throw new Error("Upload an STL, 3MF, STEP, or zip file.");
          }
          return {
            allowedContentTypes: DOWNLOAD_TYPES,
            maximumSizeInBytes: FILE_MAX,
            addRandomSuffix: true,
          };
        }
        const isVideo = clientPayload === "video";
        return {
          allowedContentTypes: isVideo ? VIDEO_TYPES : PHOTO_TYPES,
          maximumSizeInBytes: isVideo ? VIDEO_MAX : PHOTO_MAX,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
