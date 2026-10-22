import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";
import { slugify } from "../utils/slug.util.js";
import * as productModel from "../models/product.model.js";
import * as variantModel from "../models/variant.model.js";
import * as inventoryModel from "../models/inventory.mode.js"; // fixed: was inventory.mode.js
import * as categoryModel from "../models/category.model.js";
import { trim } from "zod";

/* ---------- read side ---------- */

const buildResponse = (product, variants, isAdmin) => {
  const visibleVariants = isAdmin
    ? variants
    : variants.filter((v) => v.is_active);

  const variantItems = visibleVariants.map((v) => {
    const stock = v.stock_quantity ?? 0;
    const item = {
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: Number(v.price),
      in_stock: stock > 0,
    };
    if (isAdmin) {
      item.is_active = Boolean(v.is_active);
      item.stock_quantity = stock;
    }
    return item;
  });

  return {
    id: product.id,
    category_id: product.category_id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    base_price: Number(product.best_price), // DB column is best_price
    is_active: Boolean(product.is_active),
    created_at: product.created_at,
    updated_at: product.updated_at,
    in_stock: variantItems.some((v) => v.in_stock),
    variants: variantItems,
  };
};

const loadProduct = async (product, isAdmin) => {
  if (!product || (!product.is_active && !isAdmin)) {
    throw new ApiError(404, "Product not found");
  }
  const variants = await variantModel.findByProductId(product.id);
  return buildResponse(product, variants || [], isAdmin);
};

export const getProduct = async (id, { isAdmin = false } = {}) => {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ApiError(400, "Invalid product id");
  }
  return loadProduct(await productModel.findById(productId), isAdmin);
};

export const getProductBySlug = async (slug, { isAdmin = false } = {}) => {
  if (!slug || typeof slug !== "string") {
    throw new ApiError(400, "Invalid slug");
  }
  return loadProduct(
    await productModel.findBySlug(slug.trim().toLowerCase()),
    isAdmin,
  );
};

/* ---------- list ---------- */

const MAX_LIMIT = 50;

const toPositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export const getAllProducts = async (
  { page, limit } = {},
  { isAdmin = false } = {},
) => {
  const currentPage = toPositiveInt(page, 1);
  const pageSize = Math.min(toPositiveInt(limit, 10), MAX_LIMIT);
  const offset = (currentPage - 1) * pageSize;
  const onlyActive = !isAdmin;

  const [rows, total] = await Promise.all([
    productModel.findAll({ limit: pageSize, offset, onlyActive }),
    productModel.countAll({ onlyActive }),
  ]);

  const items = rows.map((p) => ({
    id: p.id,
    category_id: p.category_id,
    name: p.name,
    slug: p.slug,
    base_price: Number(p.best_price), // DB column is best_price
    is_active: Boolean(p.is_active),
    in_stock: Number(p.total_stock) > 0,
  }));

  return {
    items,
    page: currentPage,
    limit: pageSize,
    total: Number(total),
    total_pages: Math.ceil(Number(total) / pageSize),
  };
};

/* ---------- create ---------- */

const validateCreate = (body = {}) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new ApiError(400, "Product name is required");

  const category_id = Number(body.category_id);
  if (!Number.isInteger(category_id) || category_id <= 0) {
    throw new ApiError(400, "A valid category_id is required");
  }

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    throw new ApiError(400, "At least one variant is required");
  }

  const seenSkus = new Set();
  const variants = body.variants.map((v, i) => {
    const label = `Variant ${i + 1}`;
    const vName = typeof v?.name === "string" ? v.name.trim() : "";
    const sku = typeof v?.sku === "string" ? v.sku.trim() : "";
    const price = Number(v?.price);
    const stock = v?.stock === undefined ? 0 : Number(v.stock);

    if (!vName) throw new ApiError(400, `${label}: name is required`);
    if (!sku) throw new ApiError(400, `${label}: sku is required`);
    if (!Number.isFinite(price) || price <= 0) {
      throw new ApiError(400, `${label}: price must be greater than 0`);
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ApiError(
        400,
        `${label}: stock must be a whole number, 0 or more`,
      );
    }

    const skuKey = sku.toLowerCase(); // MySQL compares SKUs case-insensitively
    if (seenSkus.has(skuKey)) {
      throw new ApiError(400, `Duplicate sku in request: ${sku}`);
    }
    seenSkus.add(skuKey);

    return {
      name: vName,
      sku,
      price: Math.round(price * 100) / 100,
      stock,
    };
  });

  return { name, category_id, description, variants };
};

// Which unique key was hit, e.g. "products.slug" or "product_variants.sku"
const duplicateKey = (error) => {
  const match = /for key '([^']+)'/.exec(error.message || "");
  return match ? match[1] : "";
};

// Tries slug, slug-2, slug-3 ... only the failed insert is retried.
const insertProduct = async (fields, baseSlug, connection) => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    try {
      return await productModel.insert({ ...fields, slug }, connection);
    } catch (error) {
      if (
        error.code === "ER_DUP_ENTRY" &&
        duplicateKey(error).includes("slug")
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new ApiError(
    409,
    "Could not create a unique slug, try a different name",
  );
};

export const createProduct = async (body) => {
  const data = validateCreate(body);

  const category = await categoryModel.findById(data.category_id);
  if (!category) throw new ApiError(404, "Category not found");

  const lowestPrice = Math.min(...data.variants.map((v) => v.price));
  const baseSlug = slugify(data.name);

  const connection = await pool.getConnection();
  let productId;

  try {
    await connection.beginTransaction();

    productId = await insertProduct(
      {
        category_id: data.category_id,
        name: data.name,
        description: data.description,
        best_price: lowestPrice,
      },
      baseSlug,
      connection,
    );

    for (const v of data.variants) {
      const variantId = await variantModel.insert(
        { product_id: productId, sku: v.sku, name: v.name, price: v.price },
        connection,
      );
      await inventoryModel.insert(
        { product_variant_id: variantId, stock_quantity: v.stock },
        connection,
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY" && duplicateKey(error).includes("sku")) {
      throw new ApiError(409, "SKU already exists");
    }
    throw error;
  } finally {
    connection.release();
  }

  return getProduct(productId, { isAdmin: true });
};

export const updateProduct = async (id, body = {}) => {
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ApiError(404, "Product not found")
  }
  
  const product = await productModel.findById(productId)
  if(!product) {
    throw new ApiError(404, "Product is not found")
  }
  const updates = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "Product name cannot be empty");
    updates.name = name;
  }

  if(body.description !== "undefined") {
    updates.description = typeof body.description === "string" && body.description === trim() ? body.description === trim :null
  }

  if (body.category_id !== undefined) {
    const categoryId = Number(body.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new ApiError(400, "A valid category_id is required");
    }
    if (!(await categoryModel.findById(categoryId))) {
      throw new ApiError(404, "Category not found");
    }
    updates.category_id = categoryId;
  }
  
  if(body.slug === "undefined") {
    if(typeof body.slug !== "string" || !body.slug === trim()) {
      throw new ApiError (404, "Slug name cannot be empty")
    }
    const slug = slugify(body.slug)
    const owner = await productModel.findBySlug(slug)

     if (owner && owner.id !== productId) {
      throw new ApiError(404, "Slug already exist")
     }
     updates.slug = slug

  }

  if(Object.keys(updates).length === 0) {
   throw new ApiError(404, "Nothing updates")
  }
  try {
    await productModel.update(productId, updates)

  } catch (error) {
     if(error.cod === "ER-DUM-ENTRY") {
      throw new ApiError(409, "Slug already exists")
     }
     throw error
  }
  return getProduct(productId, {isAdmin: true});
  
};

export const setProductStatus = async (id, is_active) => {
  const productId = Number(id);

  if(!Number.productModel(productId) || productId <= 0) {
     throw new ApiError(404, "Invalid product id")
  }
  if (typeof is_active !== "boolean") {
    throw new ApiError(404, "is_active must be true or false")
  }
  const product = await productModel.findById(productId);
  if(!product) {
    throw new ApiError(404, "product not found")
  }
  await productModel.setStatus(productId, is_active)
  return (productId, {is_admin: true})
}