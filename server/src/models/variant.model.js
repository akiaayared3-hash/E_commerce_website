// models/variant.model.js
import { pool } from "../config/db.js";
import { z } from "zod";

/* =========================================================
   Validation
========================================================= */

const positiveIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);

const productIdsSchema = z
  .array(positiveIdSchema)
  .max(1000, "Too many product IDs");

const hexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "color_hex must be #RRGGBB")
  .nullable()
  .optional();

const createVariantSchema = z
  .object({
    product_id: positiveIdSchema,
    sku: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(255),
    size: z.string().trim().max(50).nullable().optional(),
    color: z.string().trim().max(50).nullable().optional(),
    color_hex: hexSchema,
    price: z.coerce.number().finite().positive(),
    compare_at_price: z.coerce
      .number()
      .finite()
      .positive()
      .nullable()
      .optional(),
    is_active: z.boolean().optional().default(true),
  })
  .strict()
  .refine((v) => v.compare_at_price == null || v.compare_at_price > v.price, {
    message: "compare_at_price must be greater than price",
  });

const updateVariantSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(255).optional(),
    size: z.string().trim().max(50).nullable().optional(),
    color: z.string().trim().max(50).nullable().optional(),
    color_hex: hexSchema,
    price: z.coerce.number().finite().positive().optional(),
    compare_at_price: z.coerce
      .number()
      .finite()
      .positive()
      .nullable()
      .optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, {
    message: "At least one field must be provided",
  });

/** Only these columns may be written by update() */
const UPDATABLE = new Set([
  "sku",
  "name",
  "size",
  "color",
  "color_hex",
  "price",
  "compare_at_price",
  "is_active",
]);

/* =========================================================
   Shared SELECT (must match product_variants + inventory)
========================================================= */

const VARIANT_COLUMNS = `
  v.id,
  v.product_id,
  v.sku,
  v.name,
  v.size,
  v.color,
  v.color_hex,
  v.price,
  v.compare_at_price,
  v.is_active,
  COALESCE(i.stock_quantity, 0) AS stock,
  COALESCE(i.stock_quantity, 0) AS stock_quantity,
  i.low_stock_threshold
`;

const validateId = (value, name = "id") => {
  const result = positiveIdSchema.safeParse(value);
  if (!result.success) {
    const error = new Error(`Invalid ${name}`);
    error.statusCode = 400;
    throw error;
  }
  return result.data;
};

const validateInput = (schema, input) => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const error = new Error("Invalid product variant data");
    error.statusCode = 400;
    error.details = result.error.flatten();
    throw error;
  }
  return result.data;
};

/* =========================================================
   Reads
========================================================= */

export const findByProductId = async (
  product_id,
  db = pool,
  { onlyActive = false } = {},
) => {
  const productId = validateId(product_id, "product ID");

  const [rows] = await db.query(
    `SELECT ${VARIANT_COLUMNS}
       FROM product_variants v
       LEFT JOIN inventory i
         ON i.product_variant_id = v.id
      WHERE v.product_id = ?
        ${onlyActive ? "AND v.is_active = 1" : ""}
      ORDER BY v.id ASC`,
    [productId],
  );

  return rows;
};

export const findByProductIds = async (
  product_ids,
  db = pool,
  { onlyActive = false } = {},
) => {
  if (!Array.isArray(product_ids)) {
    const error = new Error("Product IDs must be an array");
    error.statusCode = 400;
    throw error;
  }

  if (product_ids.length === 0) return {};

  const parsedIds = validateInput(productIdsSchema, product_ids);
  const uniqueIds = [...new Set(parsedIds)];

  const [rows] = await db.query(
    `SELECT ${VARIANT_COLUMNS}
       FROM product_variants v
       LEFT JOIN inventory i
         ON i.product_variant_id = v.id
      WHERE v.product_id IN (?)
        ${onlyActive ? "AND v.is_active = 1" : ""}
      ORDER BY v.product_id ASC, v.id ASC`,
    [uniqueIds],
  );

  const byProduct = Object.create(null);

  for (const row of rows) {
    if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
    byProduct[row.product_id].push(row);
  }

  return byProduct;
};

export const findByIdWithStock = async (variant_id, db = pool) => {
  const variantId = validateId(variant_id, "variant ID");

  const [rows] = await db.query(
    `SELECT
       ${VARIANT_COLUMNS},
       p.is_active AS product_active
     FROM product_variants v
     INNER JOIN products p
       ON p.id = v.product_id
     LEFT JOIN inventory i
       ON i.product_variant_id = v.id
     WHERE v.id = ?
     LIMIT 1`,
    [variantId],
  );

  return rows[0] ?? null;
};

/* =========================================================
   Writes
========================================================= */

export const insert = async (input, db = pool) => {
  const data = validateInput(createVariantSchema, {
    product_id: input.product_id,
    sku: input.sku,
    name: input.name,
    size: input.size ?? null,
    color: input.color ?? null,
    color_hex: input.color_hex ?? null,
    price: input.price,
    compare_at_price: input.compare_at_price ?? null,
    is_active: input.is_active ?? true,
  });

  const [result] = await db.query(
    `INSERT INTO product_variants
      (product_id, sku, name, size, color, color_hex, price, compare_at_price, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.product_id,
      data.sku,
      data.name,
      data.size ?? null,
      data.color ?? null,
      data.color_hex ?? null,
      data.price,
      data.compare_at_price ?? null,
      data.is_active,
    ],
  );

  return result.insertId;
};

export const update = async (id, fields, db = pool) => {
  const variantId = validateId(id, "variant ID");
  const data = validateInput(updateVariantSchema, fields);

  const keys = Object.keys(data).filter(
    (key) => UPDATABLE.has(key) && data[key] !== undefined,
  );

  if (keys.length === 0) return false;

  const setClause = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => data[key]);

  const [result] = await db.query(
    `UPDATE product_variants
        SET ${setClause}
      WHERE id = ?`,
    [...values, variantId],
  );

  return result.affectedRows > 0;
};

export const setStatus = async (id, is_active, db = pool) => {
  const variantId = validateId(id, "variant ID");

  if (typeof is_active !== "boolean") {
    const error = new Error("is_active must be a boolean");
    error.statusCode = 400;
    throw error;
  }

  const [result] = await db.query(
    `UPDATE product_variants
        SET is_active = ?
      WHERE id = ?`,
    [is_active, variantId],
  );

  return result.affectedRows > 0;
};
