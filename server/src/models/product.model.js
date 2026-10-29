import { pool } from "../config/db.js";

const UPDATABLE = new Set([
  "category_id",
  "name",
  "slug",
  "description",
  "best_price",
  "is_active",
]);

const PRODUCT_COLUMNS = `
  id,
  category_id,
  name,
  slug,
  description,
  best_price,
  is_active,
  created_at,
  updated_at
`;

const normalizeId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const normalizePagination = ({ limit, offset } = {}) => {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);

  return {
    limit:
      Number.isSafeInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 50)
        : 10,
    offset:
      Number.isSafeInteger(parsedOffset) && parsedOffset >= 0
        ? parsedOffset
        : 0,
  };
};

export const insert = async (
  { category_id, name, slug, description = null, best_price, is_active = true },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO products
      (category_id, name, slug, description, best_price, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [category_id, name, slug, description, best_price, is_active],
  );

  return result.insertId;
};

export const findById = async (id, db = pool) => {
  const productId = normalizeId(id);
  if (!productId) return null;

  const [rows] = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products
      WHERE id = ?
      LIMIT 1`,
    [productId],
  );

  return rows[0] ?? null;
};

export const findBySlug = async (slug, db = pool) => {
  if (typeof slug !== "string" || !slug.trim()) {
    return null;
  }

  const [rows] = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products
      WHERE slug = ?
      LIMIT 1`,
    [slug.trim()],
  );

  return rows[0] ?? null;
};

export const update = async (id, fields, db = pool) => {
  const productId = normalizeId(id);
  if (!productId) return false;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    throw new TypeError("Product update fields must be an object");
  }

  const keys = Object.keys(fields).filter(
    (key) => UPDATABLE.has(key) && fields[key] !== undefined,
  );

  if (keys.length === 0) return false;

  const setClause = keys.map((key) => `${key} = ?`).join(", ");

  const values = keys.map((key) => fields[key]);

  const [result] = await db.query(
    `UPDATE products
        SET ${setClause}
      WHERE id = ?`,
    [...values, productId],
  );

  if (result.affectedRows > 0) return true;

  // A matching row may have already contained the submitted values.
  const existing = await findById(productId, db);
  return existing !== null;
};

export const setStatus = async (id, is_active, db = pool) => {
  const productId = normalizeId(id);

  if (!productId) return false;

  if (typeof is_active !== "boolean") {
    throw new TypeError("is_active must be a Boolean");
  }

  const [result] = await db.query(
    `UPDATE products
        SET is_active = ?
      WHERE id = ?`,
    [is_active, productId],
  );

  if (result.affectedRows > 0) return true;

  const existing = await findById(productId, db);
  return existing !== null;
};

export const findAll = async (
  { limit, offset, onlyActive = true } = {},
  db = pool,
) => {
  const pagination = normalizePagination({ limit, offset });
  const where = onlyActive ? "WHERE p.is_active = 1" : "";

  const [rows] = await db.query(
    `SELECT
       p.id,
       p.category_id,
       p.name,
       p.slug,
       p.description,
       p.best_price,
       p.is_active,
       p.created_at,
       p.updated_at,
       COALESCE((
         SELECT SUM(i.stock_quantity)
           FROM product_variants v
           JOIN inventory i
             ON i.product_variant_id = v.id
          WHERE v.product_id = p.id
            AND v.is_active = 1
       ), 0) AS total_stock
     FROM products p
     ${where}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [pagination.limit, pagination.offset],
  );

  return rows;
};

export const countAll = async ({ onlyActive = true } = {}, db = pool) => {
  const where = onlyActive ? "WHERE is_active = 1" : "";

  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
       FROM products
       ${where}`,
  );

  return Number(rows[0]?.total ?? 0);
};
