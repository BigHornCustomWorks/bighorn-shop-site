/**
 * Cloudflare R2 object storage for BHCW (S3-compatible).
 * Prefer R2 when configured; keeps Hobby Vercel free of Blob advanced-ops caps.
 *
 * Env (all required for R2 mode):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET
 *   R2_PUBLIC_BASE_URL  e.g. https://pub-xxxxx.r2.dev  or custom media subdomain
 */
import { createHash, randomBytes } from "node:crypto";

export type PutResult = { ok: true; url: string; key: string } | { ok: false; error: string };

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

function publicBase(): string {
  return String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

export function publicUrlForKey(key: string): string {
  return publicBase() + "/" + key.replace(/^\//, "");
}

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const account = process.env.R2_ACCOUNT_ID!;
  return new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function r2GetText(key: string): Promise<string | null> {
  if (!r2Configured()) return null;
  try {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    const out = await client.send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    );
    const body = out.Body;
    if (!body) return null;
    return await body.transformToString();
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (name === "NoSuchKey" || name === "NotFound") return null;
    console.error("r2 get failed:", err);
    return null;
  }
}

export async function r2PutText(
  key: string,
  text: string,
  contentType = "application/json",
): Promise<{ ok: boolean; error: string }> {
  if (!r2Configured()) return { ok: false, error: "R2 is not configured." };
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: text,
        ContentType: contentType,
        CacheControl: "max-age=60",
      }),
    );
    return { ok: true, error: "" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "R2 put failed.";
    console.error("r2 put failed:", error);
    return { ok: false, error };
  }
}

export async function r2PutBytes(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<PutResult> {
  if (!r2Configured()) return { ok: false, error: "R2 is not configured." };
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { ok: true, url: publicUrlForKey(key), key };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "R2 put failed." };
  }
}

export async function r2Delete(key: string): Promise<void> {
  if (!r2Configured()) return;
  try {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  } catch {
    /* ignore */
  }
}

export async function r2HeadExists(key: string): Promise<boolean> {
  if (!r2Configured()) return false;
  try {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Presigned PUT so the browser uploads straight to R2 (bypasses 4.5 MB serverless cap). */
export async function r2PresignPut(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<{ ok: true; uploadUrl: string; publicUrl: string; key: string } | { ok: false; error: string }> {
  if (!r2Configured()) return { ok: false, error: "R2 is not configured." };
  try {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await s3();
    const cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, cmd, { expiresIn });
    return { ok: true, uploadUrl, publicUrl: publicUrlForKey(key), key };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Presign failed." };
  }
}

export function storeObjectKey(masterSessionSecret: string): string {
  const secret = (masterSessionSecret || "").trim();
  if (!secret) return "bhcw/store.json";
  const tag = createHash("sha256").update("bhcw-store:" + secret).digest("hex").slice(0, 32);
  return "bhcw/store-" + tag + ".json";
}

export function mediaObjectKey(folder: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file.bin";
  const suffix = randomBytes(4).toString("hex");
  return `bhcw/${folder}/${Date.now()}-${suffix}-${safe}`;
}
