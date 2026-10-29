import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { config } from "../config/env.js";
import { ApiError } from "./apiError.util.js";

const UPLOAD_DIRECTORY = fileURLToPath(
  new URL("../../uploads/products/", import.meta.url),
);

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const KEY_PATTERN = /^products\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/i;

// Accepts a stored key or a legacy absolute URL and returns a safe key, or null.
const toKey = (value) => {
  if (!value || typeof value !== "string") return null;

  if (KEY_PATTERN.test(value)) return value;

  try {
    const { pathname } = new URL(value);
    const key = pathname.replace(/^\/uploads\//, "");
    return KEY_PATTERN.test(key) ? key : null;
  } catch {
    return null;
  }
};

export const buildProductImageUrl = (value) => {
  if (!value) return null;
  const key = toKey(value);
  return key ? `${config.PUBLIC_API_URL}/uploads/${key}` : value;
};

export const saveProductImage = async (file) => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw new ApiError(400, "Please select a product image.");
  }

  if (file.buffer.length > MAX_FILE_SIZE) {
    throw new ApiError(413, "Product images must be 2 MB or smaller.");
  }

  let output;

  try {
    // Detect the real format from the file contents, not the client's mimetype.
    const { format } = await sharp(file.buffer, {
      limitInputPixels: 24_000_000,
    }).metadata();

    if (!ALLOWED_FORMATS.has(format)) throw new Error("Unsupported format");

    // Re-encode: strips EXIF/hidden payloads, fixes rotation, caps size.
    output = await sharp(file.buffer, { limitInputPixels: 24_000_000 })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ApiError(400, "Upload a valid JPEG, PNG, or WebP image.");
  }

  await mkdir(UPLOAD_DIRECTORY, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  await writeFile(path.join(UPLOAD_DIRECTORY, filename), output, {
    flag: "wx",
  });

  const key = `products/${filename}`;
  return { key, url: buildProductImageUrl(key) };
};

export const deleteProductImage = async (value) => {
  const key = toKey(value);
  if (!key) return;

  const filePath = path.join(UPLOAD_DIRECTORY, path.basename(key));

  await unlink(filePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
};
