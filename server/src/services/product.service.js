// services/product.service.js
import { randomBytes } from "node:crypto";
import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";
import { slugify } from "../utils/slug.util.js";
import * as productModel from "../models/product.model.js";
import * as variantModel from "../models/variant.model.js";
import * as inventoryModel from "../models/inventory.mode.js";
import * as categoryModel from "../models/category.model.js";
import * as uploadModel from "../models/upload.model.js";
import {
  saveProductImage,
  deleteProductImage,
  buildProductImageUrl,
} from "../utils/productImageStorage.util.js";

/* =========================================================
   Constants (keep in sync with DB column sizes + frontend)
========================================================= */

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE = 10_000;

const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 5_000;
const MAX_SKU_LENGTH = 64;
const MAX_SIZE_LENGTH = 50;
const MAX_COLOR_LENGTH = 50;
const MAX_ALT_LENGTH = 255;
const MAX_VARIANTS = 50;
const MAX_IMAGES = 8;
const MAX_STOCK = 1_000_000;

const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]*$/;
const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

const ALLOWED_VIEWS = new Set([
  "front",
  "back",
  "side",
  "left",
  "right",
  "top",
  "bottom",
  "detail",
  "model",
  "lifestyle",
]);

// Must match unique index names (SHOW INDEX FROM products / product_variants)
const SLUG_INDEX = "uq_products_slug";
const SKU_INDEX = "uq_variants_sku";
const SLUG_ATTEMPTS = 5;

/* =========================================================
   Helpers
========================================================= */

const toId = (value) => {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d{1,15}$/.test(text.trim())) return null;
  const number = Number(text.trim());
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value, field, maxLength) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
};

const toBoolean = (value) => {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return null;
};

const parseOptionalJson = (value, field) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new ApiError(400, `${field} must contain valid JSON`);
  }
};

const parseMoney = (value) => {
  const raw =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value.trim()
        : "";
  if (!MONEY_PATTERN.test(raw)) return null;
  const number = Number(raw);
  return number > 0 ? number : null;
};

const parseStock = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= MAX_STOCK
    ? number
    : null;
};

const parsePositiveInt = (value, fallback, field) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const number = toId(value);
  if (!number) {
    throw new ApiError(400, `${field} must be a positive whole number`);
  }
  return number;
};

const normalizeSize = (value) => {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return null;
  return /^[a-z]{1,4}$/i.test(s) ? s.toUpperCase() : s;
};

const normalizeColor = (value) => {
  const s = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const duplicateKey = (error) => {
  const match = /for key ['"`]([^'"`]+)['"`]/i.exec(error?.message ?? "");
  return match?.[1] ?? "";
};

const isDuplicateKey = (error, key) =>
  error?.code === "ER_DUP_ENTRY" &&
  duplicateKey(error).toLowerCase().includes(key.toLowerCase());

const mapDbError = (error) => {
  if (error instanceof ApiError) return error;

  if (isDuplicateKey(error, SKU_INDEX) || isDuplicateKey(error, "sku")) {
    return new ApiError(409, "A product variant with this SKU already exists");
  }
  if (isDuplicateKey(error, SLUG_INDEX) || isDuplicateKey(error, "slug")) {
    return new ApiError(409, "Product slug already exists");
  }

  switch (error?.code) {
    case "ER_NO_REFERENCED_ROW":
    case "ER_NO_REFERENCED_ROW_2":
      return new ApiError(
        400,
        "A referenced record (such as the category) no longer exists",
      );
    case "ER_DATA_TOO_LONG":
      return new ApiError(400, "One of the values is too long");
    case "ER_WARN_DATA_OUT_OF_RANGE":
    case "ER_DATA_OUT_OF_RANGE":
      return new ApiError(400, "One of the numeric values is out of range");
    default:
      return error;
  }
};

const logError = (message, error, context = {}) => {
  console.error(message, {
    ...context,
    code: error?.code,
    message: error?.message,
    stack: error?.stack,
  });
};

const randomSuffix = (bytes = 3) => randomBytes(bytes).toString("hex");

const makeBaseSlug = (name) => slugify(name) || `product-${randomSuffix()}`;

const discardImages = async (savedList, context) => {
  for (const image of savedList ?? []) {
    if (!image?.key) continue;
    try {
      await deleteProductImage(image.key);
    } catch (cleanupError) {
      logError("Product image cleanup failed", cleanupError, context);
    }
  }
};

/* =========================================================
   Response mapping
========================================================= */

const stockOf = (variant) =>
  Math.max(0, Number(variant.stock ?? variant.stock_quantity) || 0);

const mapVariant = (variant, isAdmin) => {
  const stock = stockOf(variant);
  const threshold =
    variant.low_stock_threshold == null
      ? null
      : Number(variant.low_stock_threshold);

  const item = {
    id: variant.id,
    product_id: variant.product_id,
    name: variant.name,
    sku: variant.sku,
    size: variant.size ?? "",
    color: variant.color ?? "",
    color_hex: variant.color_hex ?? null,
    price: Number(variant.price),
    compare_at_price:
      variant.compare_at_price != null
        ? Number(variant.compare_at_price)
        : null,
    stock,
    in_stock: stock > 0,
    low_stock: threshold !== null && stock > 0 && stock <= threshold,
  };

  if (isAdmin) {
    item.stock_quantity = stock;
    item.low_stock_threshold = threshold;
    item.is_active = toBoolean(variant.is_active) === true;
  }

  return item;
};

const visibleVariantsOf = (variants, isAdmin) =>
  isAdmin
    ? variants
    : variants.filter((variant) => toBoolean(variant.is_active) === true);

const priceFrom = (product, variants) =>
  variants.length > 0
    ? Math.min(...variants.map((variant) => Number(variant.price)))
    : Number(product.best_price);

const pickMainImage = (images) =>
  images.find((image) => toBoolean(image.is_primary) === true) ??
  images.find((image) => image.view_type === "front") ??
  images[0] ??
  null;

const mapCategory = (category) =>
  category
    ? {
        id: category.id,
        name: category.name,
        slug: category.slug ?? null,
      }
    : null;

const buildResponse = (
  product,
  variants = [],
  isAdmin = false,
  images = [],
  category = null,
) => {
  const visible = visibleVariantsOf(variants, isAdmin);
  const variantItems = visible.map((variant) => mapVariant(variant, isAdmin));
  const main = pickMainImage(images);

  return {
    id: product.id,
    category_id: product.category_id,
    category: mapCategory(category),
    name: product.name,
    slug: product.slug,
    description: product.description,
    base_price: priceFrom(product, visible),
    is_active: toBoolean(product.is_active) === true,
    created_at: product.created_at,
    updated_at: product.updated_at,
    in_stock: variantItems.some((variant) => variant.in_stock),
    image: main ? buildProductImageUrl(main.url) : null,
    images: images.map((image) => ({
      id: image.id,
      url: buildProductImageUrl(image.url),
      view: image.view_type,
      color: image.color ?? null,
      alt: image.alt ?? null,
      is_primary: toBoolean(image.is_primary) === true,
      sort_order: Number(image.sort_order) || 0,
    })),
    variants: variantItems,
  };
};

/* =========================================================
   Read
========================================================= */

const loadProduct = async (product, isAdmin = false) => {
  if (!product || (toBoolean(product.is_active) !== true && !isAdmin)) {
    throw new ApiError(404, "Product not found");
  }

  const [variants, images, category] = await Promise.all([
    variantModel.findByProductId(product.id, pool, { onlyActive: !isAdmin }),
    uploadModel.listByProduct(product.id),
    categoryModel.findById(product.category_id),
  ]);

  return buildResponse(
    product,
    variants ?? [],
    isAdmin,
    images ?? [],
    category ?? null,
  );
};

export const getProduct = async (id, { isAdmin = false } = {}) => {
  const productId = toId(id);
  if (!productId) throw new ApiError(400, "Invalid product ID");
  return loadProduct(await productModel.findById(productId), isAdmin);
};

export const getProductBySlug = async (slug, { isAdmin = false } = {}) => {
  if (
    typeof slug !== "string" ||
    !slug.trim() ||
    slug.length > MAX_NAME_LENGTH
  ) {
    throw new ApiError(400, "Invalid product slug");
  }
  const product = await productModel.findBySlug(slug.trim().toLowerCase());
  return loadProduct(product, isAdmin);
};

export const getAllProducts = async (
  { page, limit } = {},
  { isAdmin = false } = {},
) => {
  const currentPage = parsePositiveInt(page, 1, "page");
  const pageSize = Math.min(
    parsePositiveInt(limit, DEFAULT_PAGE_SIZE, "limit"),
    MAX_PAGE_SIZE,
  );

  if (currentPage > MAX_PAGE) {
    throw new ApiError(400, "Requested page is too large");
  }

  const offset = (currentPage - 1) * pageSize;
  const onlyActive = !isAdmin;

  const [rows, total] = await Promise.all([
    productModel.findAll({ limit: pageSize, offset, onlyActive }),
    productModel.countAll({ onlyActive }),
  ]);

  const productIds = rows.map((product) => product.id);

  const [imageRows, variantsByProduct] = await Promise.all([
    productIds.length
      ? uploadModel.listByProductIds(productIds)
      : Promise.resolve([]),
    productIds.length
      ? variantModel.findByProductIds(productIds, pool, { onlyActive })
      : Promise.resolve({}),
  ]);

  const imagesByProduct = new Map();
  for (const image of imageRows) {
    const existing = imagesByProduct.get(image.product_id);
    const isPrimary = toBoolean(image.is_primary) === true;
    const isFront = image.view_type === "front";
    if (
      !existing ||
      (isPrimary && toBoolean(existing.is_primary) !== true) ||
      (isFront &&
        existing.view_type !== "front" &&
        toBoolean(existing.is_primary) !== true)
    ) {
      imagesByProduct.set(image.product_id, image);
    }
  }

  const items = rows.map((product) => {
    const visible = visibleVariantsOf(
      variantsByProduct[product.id] ?? [],
      isAdmin,
    );
    const image = imagesByProduct.get(product.id);

    return {
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      base_price: priceFrom(product, visible),
      is_active: toBoolean(product.is_active) === true,
      in_stock: visible.some((variant) => stockOf(variant) > 0),
      variant_count: visible.length,
      image: image ? buildProductImageUrl(image.url) : null,
    };
  });

  const totalCount = Number(total) || 0;

  return {
    items,
    page: currentPage,
    limit: pageSize,
    total: totalCount,
    total_pages: Math.ceil(totalCount / pageSize) || 0,
  };
};

/* =========================================================
   Validation — variants (frontend contract)
========================================================= */

const validateVariants = (rawVariants, productName) => {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
    throw new ApiError(400, "At least one product variant is required");
  }
  if (rawVariants.length > MAX_VARIANTS) {
    throw new ApiError(
      400,
      `A product can have at most ${MAX_VARIANTS} variants`,
    );
  }

  const seenSkus = new Set();
  const seenCombos = new Set();
  const hexByColor = new Map();

  return rawVariants.map((variant, index) => {
    const label = `Variant ${index + 1}`;
    if (!isPlainObject(variant)) {
      throw new ApiError(400, `${label}: invalid data`);
    }

    const id =
      variant.id !== undefined && variant.id !== null && variant.id !== ""
        ? toId(variant.id)
        : null;

    const sku = text(
      variant.sku,
      `${label}: SKU`,
      MAX_SKU_LENGTH,
    )?.toUpperCase();
    if (!sku) throw new ApiError(400, `${label}: SKU is required`);
    if (!SKU_PATTERN.test(sku)) {
      throw new ApiError(
        400,
        `${label}: SKU may only contain letters, numbers, dots, dashes and underscores`,
      );
    }

    const size = normalizeSize(variant.size);
    if (!size) throw new ApiError(400, `${label}: Size is required`);
    if (size.length > MAX_SIZE_LENGTH) {
      throw new ApiError(400, `${label}: size is too long`);
    }

    const color = normalizeColor(variant.color);
    if (!color) throw new ApiError(400, `${label}: Color is required`);
    if (color.length > MAX_COLOR_LENGTH) {
      throw new ApiError(400, `${label}: color is too long`);
    }

    let color_hex = null;
    if (variant.color_hex != null && String(variant.color_hex).trim() !== "") {
      const hex = String(variant.color_hex).trim();
      if (!HEX_PATTERN.test(hex)) {
        throw new ApiError(400, `${label}: color_hex must be #RRGGBB`);
      }
      color_hex = hex.toUpperCase();
    }

    const name =
      text(variant.name, `${label}: name`, MAX_NAME_LENGTH) ??
      `${productName} - ${size} / ${color}`;

    const price = parseMoney(variant.price);
    if (price === null) {
      throw new ApiError(
        400,
        `${label}: price must be greater than zero, with at most 2 decimals`,
      );
    }

    let compare_at_price = null;
    if (
      variant.compare_at_price !== undefined &&
      variant.compare_at_price !== null &&
      String(variant.compare_at_price).trim() !== ""
    ) {
      compare_at_price = parseMoney(variant.compare_at_price);
      if (compare_at_price === null || compare_at_price <= price) {
        throw new ApiError(
          400,
          `${label}: compare_at_price must be higher than price`,
        );
      }
    }

    const stock = parseStock(variant.stock);
    if (stock === null) {
      throw new ApiError(
        400,
        `${label}: stock must be a whole number between 0 and ${MAX_STOCK}`,
      );
    }

    let is_active = true;
    if (variant.is_active !== undefined) {
      is_active = toBoolean(variant.is_active);
      if (is_active === null) {
        throw new ApiError(400, `${label}: is_active must be boolean-like`);
      }
    }

    const skuKey = sku.toLowerCase();
    if (seenSkus.has(skuKey)) {
      throw new ApiError(400, `Duplicate SKU in request: ${sku}`);
    }
    seenSkus.add(skuKey);

    const comboKey = `${size.toLowerCase()}|${color.toLowerCase()}`;
    if (seenCombos.has(comboKey)) {
      throw new ApiError(400, `Duplicate size/color: ${size} / ${color}`);
    }
    seenCombos.add(comboKey);

    if (color_hex) {
      const known = hexByColor.get(color.toLowerCase());
      if (known && known !== color_hex) {
        throw new ApiError(
          400,
          `${label}: ${color} has conflicting swatch colors`,
        );
      }
      hexByColor.set(color.toLowerCase(), color_hex);
    }

    return {
      id,
      name,
      sku,
      size,
      color,
      color_hex,
      price,
      compare_at_price,
      stock,
      is_active,
    };
  });
};

/* =========================================================
   Validation — images_meta + files
========================================================= */

const validateImagesMeta = (rawMeta, files, { allowEmpty = false } = {}) => {
  const meta = parseOptionalJson(rawMeta, "images_meta");
  const fileList = Array.isArray(files) ? files : [];

  if (meta == null) {
    if (allowEmpty && fileList.length === 0) {
      return { entries: [] };
    }
    if (!allowEmpty) {
      throw new ApiError(400, "At least one product image is required");
    }
    return { entries: [] };
  }

  if (!Array.isArray(meta)) {
    throw new ApiError(400, "images_meta must be a JSON array");
  }
  if (meta.length > MAX_IMAGES) {
    throw new ApiError(400, `At most ${MAX_IMAGES} images are allowed`);
  }

  const newCount = meta.filter((m) => m && m.new === true).length;
  if (newCount !== fileList.length) {
    throw new ApiError(
      400,
      `images_meta has ${newCount} new image(s) but ${fileList.length} file(s) were uploaded`,
    );
  }

  let fileIndex = 0;
  const entries = meta.map((item, index) => {
    const label = `Image ${index + 1}`;
    if (!isPlainObject(item)) {
      throw new ApiError(400, `${label}: invalid data`);
    }

    const view = String(item.view ?? "")
      .trim()
      .toLowerCase();
    if (!view || !ALLOWED_VIEWS.has(view)) {
      throw new ApiError(
        400,
        `${label}: view must be one of: ${[...ALLOWED_VIEWS].join(", ")}`,
      );
    }

    const color =
      item.color != null && String(item.color).trim() !== ""
        ? normalizeColor(item.color)
        : null;

    const alt = text(item.alt, `${label}: alt`, MAX_ALT_LENGTH);
    const is_primary = toBoolean(item.is_primary) === true;
    const sort_order = Number.isFinite(Number(item.sort_order))
      ? Number(item.sort_order)
      : index;

    if (item.new === true) {
      const file = fileList[fileIndex++];
      if (!file) throw new ApiError(400, `${label}: missing uploaded file`);
      return {
        id: null,
        isNew: true,
        file,
        view,
        color,
        alt,
        is_primary,
        sort_order,
      };
    }

    const id = toId(item.id);
    if (!id) {
      throw new ApiError(400, `${label}: existing image requires a valid id`);
    }

    return {
      id,
      isNew: false,
      file: null,
      view,
      color,
      alt,
      is_primary,
      sort_order,
    };
  });

  if (entries.length === 0 && !allowEmpty) {
    throw new ApiError(400, "At least one product image is required");
  }

  if (entries.length > 0) {
    const primaryCount = entries.filter((e) => e.is_primary).length;
    if (primaryCount === 0) {
      entries[0].is_primary = true;
    } else if (primaryCount > 1) {
      let seen = false;
      for (const e of entries) {
        if (e.is_primary) {
          if (seen) e.is_primary = false;
          else seen = true;
        }
      }
    }
  }

  return { entries };
};

const parseRemovedImageIds = (raw) => {
  const parsed = parseOptionalJson(raw, "removed_image_ids");
  if (parsed == null) return [];
  if (!Array.isArray(parsed)) {
    throw new ApiError(400, "removed_image_ids must be a JSON array");
  }
  return parsed.map((id) => toId(id)).filter((id) => id !== null);
};

const validateCreate = (raw) => {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
    throw new ApiError(
      400,
      "Product data is missing. Send JSON or correctly parsed multipart form data.",
    );
  }

  const body =
    isPlainObject(raw.product) && raw.name === undefined ? raw.product : raw;

  const name = text(body.name, "Product name", MAX_NAME_LENGTH);
  if (!name) throw new ApiError(400, "Product name is required");

  const category_id = toId(body.category_id);
  if (!category_id) {
    throw new ApiError(400, "A valid category ID is required");
  }

  const description = text(
    body.description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );

  let is_active = true;
  if (body.is_active !== undefined) {
    is_active = toBoolean(body.is_active);
    if (is_active === null) {
      throw new ApiError(400, "is_active must be a boolean-like value");
    }
  }

  const variants = validateVariants(
    parseOptionalJson(body.variants, "variants"),
    name,
  );

  return { name, category_id, description, is_active, variants };
};

/* =========================================================
   Create
========================================================= */

const insertProductWithUniqueSlug = async (fields, baseSlug, connection) => {
  for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${randomSuffix()}`;
    try {
      return await productModel.insert({ ...fields, slug }, connection);
    } catch (error) {
      if (isDuplicateKey(error, SLUG_INDEX) || isDuplicateKey(error, "slug")) {
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(409, "Could not generate a unique product slug");
};

export const createProduct = async (body, { files = [] } = {}) => {
  const data = validateCreate(body);
  const { entries: imageEntries } = validateImagesMeta(
    body.images_meta,
    files,
    {
      allowEmpty: false,
    },
  );

  const variantColors = new Set(
    data.variants.map((v) => v.color.toLowerCase()),
  );
  for (const img of imageEntries) {
    if (img.color && !variantColors.has(img.color.toLowerCase())) {
      throw new ApiError(
        400,
        `Image color "${img.color}" is not used by any variant`,
      );
    }
  }

  const category = await categoryModel.findById(data.category_id);
  if (!category) throw new ApiError(404, "Category not found");

  const lowestPrice = Math.min(...data.variants.map((v) => v.price));
  const baseSlug = makeBaseSlug(data.name);

  const savedImages = [];
  try {
    for (const entry of imageEntries) {
      if (!entry.isNew || !entry.file) continue;
      const saved = await saveProductImage(entry.file);
      savedImages.push({ ...saved, meta: entry });
    }
  } catch (error) {
    await discardImages(savedImages, { action: "create-preprocess" });
    throw error instanceof ApiError
      ? error
      : new ApiError(400, "Failed to process product image");
  }

  let connection;
  let productId;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    productId = await insertProductWithUniqueSlug(
      {
        category_id: data.category_id,
        name: data.name,
        description: data.description,
        best_price: lowestPrice,
        is_active: data.is_active,
      },
      baseSlug,
      connection,
    );

    for (const variant of data.variants) {
      const variantId = await variantModel.insert(
        {
          product_id: productId,
          sku: variant.sku,
          name: variant.name,
          size: variant.size,
          color: variant.color,
          color_hex: variant.color_hex,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          is_active: variant.is_active,
        },
        connection,
      );

      await inventoryModel.insert(
        { product_variant_id: variantId, stock_quantity: variant.stock },
        connection,
      );
    }

    for (const saved of savedImages) {
      const m = saved.meta;
      await uploadModel.saveView(
        {
          product_id: productId,
          view_type: m.view,
          url: saved.url,
          color: m.color,
          alt: m.alt,
          is_primary: m.is_primary,
          sort_order: m.sort_order,
        },
        connection,
      );
    }

    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError("Product create rollback failed", rollbackError);
      }
    }
    await discardImages(savedImages, { action: "create" });
    logError("Product create failed", error);
    throw mapDbError(error);
  } finally {
    connection?.release();
  }

  try {
    return await getProduct(productId, { isAdmin: true });
  } catch (error) {
    logError("Product created but could not be loaded", error, { productId });
    throw new ApiError(
      500,
      "Product was created but could not be loaded. Refresh the product list.",
    );
  }
};

/* =========================================================
   Update (product + variants upsert + images)
========================================================= */

export const updateProduct = async (id, body = {}, { files = [] } = {}) => {
  const productId = toId(id);
  if (!productId) throw new ApiError(400, "Invalid product ID");
  if (!isPlainObject(body)) {
    throw new ApiError(400, "Invalid product update data");
  }

  const product = await productModel.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  const updates = {};

  if (body.name !== undefined) {
    const name = text(body.name, "Product name", MAX_NAME_LENGTH);
    if (!name) throw new ApiError(400, "Product name cannot be empty");
    updates.name = name;
  }

  if (body.description !== undefined) {
    updates.description = text(
      body.description,
      "Description",
      MAX_DESCRIPTION_LENGTH,
    );
  }

  if (
    body.category_id !== undefined &&
    String(body.category_id).trim() !== ""
  ) {
    const categoryId = toId(body.category_id);
    if (!categoryId) throw new ApiError(400, "Invalid category ID");
    if (!(await categoryModel.findById(categoryId))) {
      throw new ApiError(404, "Category not found");
    }
    updates.category_id = categoryId;
  }

  if (body.slug !== undefined) {
    const rawSlug = text(body.slug, "Slug", MAX_NAME_LENGTH);
    if (!rawSlug) throw new ApiError(400, "Slug cannot be empty");
    const slug = slugify(rawSlug);
    if (!slug) throw new ApiError(400, "Invalid slug");
    const owner = await productModel.findBySlug(slug);
    if (owner && Number(owner.id) !== productId) {
      throw new ApiError(409, "Slug already exists");
    }
    updates.slug = slug;
  }

  const hasVariants = body.variants !== undefined && body.variants !== "";
  const hasImagesMeta =
    body.images_meta !== undefined && body.images_meta !== "";
  const removedIds = parseRemovedImageIds(body.removed_image_ids);
  const hasFileUploads = Array.isArray(files) && files.length > 0;

  if (
    Object.keys(updates).length === 0 &&
    !hasVariants &&
    !hasImagesMeta &&
    !hasFileUploads &&
    removedIds.length === 0
  ) {
    throw new ApiError(400, "No valid fields provided for update");
  }

  const productName = updates.name ?? product.name;

  let variantsPayload = null;
  if (hasVariants) {
    variantsPayload = validateVariants(
      parseOptionalJson(body.variants, "variants"),
      productName,
    );
  }

  let imagePlan = null;
  if (hasImagesMeta || hasFileUploads) {
    imagePlan = validateImagesMeta(body.images_meta, files, {
      allowEmpty: true,
    });
  }

  if (imagePlan && variantsPayload) {
    const variantColors = new Set(
      variantsPayload.map((v) => v.color.toLowerCase()),
    );
    for (const img of imagePlan.entries) {
      if (img.color && !variantColors.has(img.color.toLowerCase())) {
        throw new ApiError(
          400,
          `Image color "${img.color}" is not used by any variant`,
        );
      }
    }
  }

  const savedNewImages = [];
  if (imagePlan) {
    try {
      for (const entry of imagePlan.entries) {
        if (!entry.isNew || !entry.file) continue;
        const saved = await saveProductImage(entry.file);
        savedNewImages.push({ ...saved, meta: entry });
      }
    } catch (error) {
      await discardImages(savedNewImages, {
        action: "update-preprocess",
        productId,
      });
      throw error instanceof ApiError
        ? error
        : new ApiError(400, "Failed to process product image");
    }
  }

  let connection;
  const urlsToDeleteAfterCommit = [];

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [locked] = await connection.query(
      "SELECT id FROM products WHERE id = ? FOR UPDATE",
      [productId],
    );
    if (!locked?.length) throw new ApiError(404, "Product not found");

    if (Object.keys(updates).length > 0) {
      await productModel.update(productId, updates, connection);
    } else {
      await connection.query(
        "UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [productId],
      );
    }

    if (variantsPayload) {
      const existing = await variantModel.findByProductId(
        productId,
        connection,
        { onlyActive: false },
      );
      const existingById = new Map(
        (existing ?? []).map((v) => [Number(v.id), v]),
      );
      const keepIds = new Set();

      for (const v of variantsPayload) {
        if (v.id && existingById.has(v.id)) {
          keepIds.add(v.id);
          await variantModel.update(
            v.id,
            {
              sku: v.sku,
              name: v.name,
              size: v.size,
              color: v.color,
              color_hex: v.color_hex,
              price: v.price,
              compare_at_price: v.compare_at_price,
              is_active: v.is_active,
            },
            connection,
          );
          await inventoryModel.setStockByVariantId(v.id, v.stock, connection);
        } else {
          const variantId = await variantModel.insert(
            {
              product_id: productId,
              sku: v.sku,
              name: v.name,
              size: v.size,
              color: v.color,
              color_hex: v.color_hex,
              price: v.price,
              compare_at_price: v.compare_at_price,
              is_active: v.is_active,
            },
            connection,
          );
          keepIds.add(variantId);
          await inventoryModel.insert(
            { product_variant_id: variantId, stock_quantity: v.stock },
            connection,
          );
        }
      }

      for (const [vid] of existingById) {
        if (!keepIds.has(vid)) {
          await variantModel.setStatus(vid, false, connection);
        }
      }

      const lowest = Math.min(...variantsPayload.map((v) => v.price));
      await productModel.update(productId, { best_price: lowest }, connection);
    }

    if (removedIds.length) {
      for (const imageId of removedIds) {
        const removed = await uploadModel.removeById(
          imageId,
          productId,
          connection,
        );
        if (removed?.url) urlsToDeleteAfterCommit.push(removed.url);
      }
    }

    if (imagePlan) {
      let newIdx = 0;
      for (const entry of imagePlan.entries) {
        if (entry.isNew) {
          const saved = savedNewImages[newIdx++];
          if (!saved) continue;
          await uploadModel.saveView(
            {
              product_id: productId,
              view_type: entry.view,
              url: saved.url,
              color: entry.color,
              alt: entry.alt,
              is_primary: entry.is_primary,
              sort_order: entry.sort_order,
            },
            connection,
          );
        } else {
          await uploadModel.updateMeta(
            entry.id,
            productId,
            {
              view_type: entry.view,
              color: entry.color,
              alt: entry.alt,
              is_primary: entry.is_primary,
              sort_order: entry.sort_order,
            },
            connection,
          );
        }
      }
    }

    await connection.commit();
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logError("Product update rollback failed", rollbackError, {
          productId,
        });
      }
    }
    await discardImages(savedNewImages, { action: "update", productId });
    logError("Product update failed", error, { productId });
    throw mapDbError(error);
  } finally {
    connection?.release();
  }

  for (const oldValue of urlsToDeleteAfterCommit) {
    try {
      await deleteProductImage(oldValue);
    } catch (cleanupError) {
      logError("Old product image cleanup failed", cleanupError, {
        productId,
        oldValue,
      });
    }
  }

  return getProduct(productId, { isAdmin: true });
};

/* =========================================================
   Status
========================================================= */

export const setProductStatus = async (id, is_active) => {
  const productId = toId(id);
  if (!productId) throw new ApiError(400, "Invalid product ID");

  const active = toBoolean(is_active);
  if (active === null) {
    throw new ApiError(400, "is_active must be a boolean-like value");
  }

  const product = await productModel.findById(productId);
  if (!product) throw new ApiError(404, "Product not found");

  if (toBoolean(product.is_active) !== active) {
    await productModel.setStatus(productId, active);
  }

  return getProduct(productId, { isAdmin: true });
};
