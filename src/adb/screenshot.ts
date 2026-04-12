import sharp from "sharp";
import { adbRawBuffer } from "./client.js";

const DEFAULT_WIDTH = 540;
const DEFAULT_JPEG_QUALITY = 60;

export async function captureScreenshot(
  width: number = DEFAULT_WIDTH,
  quality: number = DEFAULT_JPEG_QUALITY
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
  // Capture raw screencap via ADB
  const raw = await adbRawBuffer("exec-out", "screencap", "-p");

  // Resize and compress with sharp
  const compressed = await sharp(raw)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();

  return { buffer: compressed, mimeType: "image/jpeg" };
}
