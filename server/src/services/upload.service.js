// utils/productImageStorage.util.js
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Disk layout:
 *   <project>/uploads/products/<uuid>.<ext>
 * Public URL:
 *   {PUBLIC_BASE_URL}/uploads/products/<uuid>.<ext>
 *   or relative /uploads/products/... if PUBLIC_BASE_URL is empty
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Prefer project-root /uploads/products (same as express.static)
const UPLOAD_DIR =
  process.env.PRODUCT_UPLOAD_DIR ||
  path.join(process.cwd(), "uploads", "products");

const URL_PATH_PREFIX = "/uploads/products";

const ALLOWED_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const ensureDir = async () => {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
};

/**
 * Turn stored value (absolute URL, path, or key) into a public URL for API responses.
 */
export const buildProductImageUrl = (value) => {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  // Already absolute
  if (/^https?:\/\//i.test(s)) return s;

  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const pathPart = s.startsWith("/") ? s : `/${s.replace(/^\/+/, "")}`;

  return base ? `${base}${pathPart}` : pathPart;
};

/**
 * Resolve a stored url / key to an absolute filesystem path for deletion.
 */
const toFilesystemPath = (value) => {
  if (value == null) return null;
  let s = String(value).trim();
  if (!s) return null;

  // Strip origin if absolute URL
  try {
    if (/^https?:\/\//i.test(s)) {
      s = new URL(s).pathname;
    }
  } catch {
    // keep s
  }

  // "/uploads/products/foo.jpg" → "uploads/products/foo.jpg"
  s = s.replace(/^\/+/, "");

  // Only allow files under uploads/products
  const normalized = path.normalize(s).replace(/^(\.\.(\/|\\|$))+/, "");
  if (
    !normalized.startsWith("uploads/products/") &&
    !normalized.startsWith("uploads\\products\\")
  ) {
    // If value is only a filename
    if (!normalized.includes("/") && !normalized.includes("\\")) {
      return path.join(UPLOAD_DIR, normalized);
    }
    return null;
  }

  return path.join(process.cwd(), normalized);
};

/**
 * Save one multer memory file ({ buffer, mimetype, originalname }).
 * Returns { key, url } where url is what you store in product_images.url
 * and key is used for cleanup (same as relative path or filename).
 */
export const saveProductImage = async (file) => {
  if (!file?.buffer?.length) {
    throw new Error("Empty image file");
  }

  const ext = ALLOWED_MIME.get(file.mimetype);
  if (!ext) {
    throw new Error("Only JPEG, PNG, and WebP images are allowed");
  }

  await ensureDir();

  const filename = `${randomUUID()}.${ext}`;
  const absPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(absPath, file.buffer);

  const relativeUrl = `${URL_PATH_PREFIX}/${filename}`;
  const publicUrl = buildProductImageUrl(relativeUrl);

  return {
    key: relativeUrl, // used by discardImages → deleteProductImage
    url: publicUrl, // stored in DB (or store relativeUrl if you prefer)
    filename,
  };
};

/**
 * Delete by key, relative path, or full URL previously stored / returned.
 */
export const deleteProductImage = async (value) => {
  const abs = toFilesystemPath(value);
  if (!abs) return;

  try {
    await fs.unlink(abs);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
};
