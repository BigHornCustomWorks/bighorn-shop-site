const MAX_EDGE = 2000;
const QUALITY = 0.82;
const SKIP_UNDER = 400_000;

/**
 * Shrink a photo in the browser before it is uploaded. Phone photos run 3-12 MB,
 * which is slow to send and far more detail than a shop page renders. Anything
 * unexpected (an odd format, a browser without createImageBitmap, a canvas that
 * refuses) returns the original file rather than failing the upload.
 *
 * GIFs are left alone: redrawing one onto a canvas throws away the animation.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;
  if (file.size < SKIP_UNDER) return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY);
    });
    // If re-encoding made it bigger, the original was already well compressed.
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
