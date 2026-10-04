import "server-only";
import sharp from "sharp";
import { MAX_SUPPORT_IMAGES, MAX_SUPPORT_IMAGE_BYTES, MAX_SUPPORT_REQUEST_BYTES, SUPPORT_IMAGE_TYPES } from "@/lib/support-attachments";
import { SupportError } from "@/lib/support";

export interface SupportImage { data: Buffer; contentType: "image/webp" }
export async function decodeSupportImages(files: File[]): Promise<SupportImage[]> {
  if (files.length > MAX_SUPPORT_IMAGES) throw new SupportError("每次最多上传 3 张截图");
  const images: SupportImage[] = [];
  for (const file of files) {
    if (!SUPPORT_IMAGE_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_SUPPORT_IMAGE_BYTES) throw new SupportError("截图须为 JPG、PNG 或 WebP，处理后每张不超过 800KB");
    try {
      const input = Buffer.from(await file.arrayBuffer());
      const image = sharp(input, { limitInputPixels: 20_000_000, failOn: "warning" });
      const meta = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) !== 1) throw new Error("Unsupported image");
      // Decode and re-encode, removing EXIF and any non-image payload.
      const data = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      if (data.length > MAX_SUPPORT_IMAGE_BYTES) throw new SupportError("截图内容过大，请裁剪后重新上传");
      images.push({ data, contentType: "image/webp" });
    } catch (error) {
      if (error instanceof SupportError) throw error;
      throw new SupportError("截图无法读取，请选择完整的 JPG、PNG 或 WebP 图片");
    }
  }
  return images;
}

export async function readSupportRequest(request: Request) {
  const limit = request.headers.get("content-type")?.startsWith("multipart/form-data") ? MAX_SUPPORT_REQUEST_BYTES : 24000;
  if (Number(request.headers.get("content-length")) > limit) throw new SupportError("上传内容过大，请减少截图或压缩后重试", 413);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new SupportError("上传内容过大，请减少截图或压缩后重试", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const buffer = Buffer.concat(chunks);
  try {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await new Response(buffer, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
      const payload = form.get("payload");
      const files = form.getAll("screenshots");
      if (typeof payload !== "string" || payload.length > 24000 || files.some(file => typeof file === "string")) throw new SupportError("上传格式无效");
      return { value: JSON.parse(payload), files: files as File[] };
    }
    return { value: JSON.parse(buffer.toString("utf8")), files: [] as File[] };
  } catch (error) {
    if (error instanceof SupportError) throw error;
    throw new SupportError("请求格式无效");
  }
}
