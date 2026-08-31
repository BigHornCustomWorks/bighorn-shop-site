import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isMaster } from "@/lib/auth";
import { PHOTO_MAX, PHOTO_TYPES, VIDEO_MAX, VIDEO_TYPES } from "@/lib/uploadLimits";

export const runtime = "nodejs";

/**
 * Issues short-lived tokens so the browser can upload straight to Vercel Blob,
 * which is the only way past the 4.5 MB serverless request-body limit.
 *
 * This route deliberately sits OUTSIDE /api/master. When an upload finishes,
 * Vercel Blob calls this URL back server-to-server, and that request carries no
 * session cookie — the master middleware would reject it. Authentication
 * happens in onBeforeGenerateToken instead, which only runs on the browser's
 * own request, so no token is ever minted for a stranger.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!(await isMaster())) throw new Error("Not signed in to Master Control.");
        const isVideo = clientPayload === "video";
        return {
          allowedContentTypes: isVideo ? VIDEO_TYPES : PHOTO_TYPES,
          maximumSizeInBytes: isVideo ? VIDEO_MAX : PHOTO_MAX,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do: the browser already has the URL back from upload() and
        // saves it with the product. Vercel cannot reach localhost, so this
        // callback never fires in local development anyway.
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
