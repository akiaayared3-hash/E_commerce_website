import { pool } from "../config/db.js";

const UPDATABLE = [
  "category_id",
  "name",
  "slug",
  "description",
  "best_price",
  "is_active",
];

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
  const [rows] = await db.query(
    `SELECT id, category_id, name, slug, description, best_price, is_active, created_at, updated_at
     FROM products WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
};

export const findBySlug = async (slug, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, category_id, name, slug, description, best_price, is_active, created_at, updated_at
     FROM products WHERE slug = ?`,
    [slug],
  );
  return rows[0] ?? null;
};

export const update = async (id, fields, db = pool) => {
  const keys = Object.keys(fields).filter(
    (k) => UPDATABLE.includes(k) && fields[k] !== undefined,
  );
  if (keys.length === 0) return false;

  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const [result] = await db.query(
    `UPDATE products SET ${setClause} WHERE id = ?`,
    [...keys.map((k) => fields[k]), id],
  );
  return result.affectedRows > 0;
};

export const setStatus = async (id, is_active, db = pool) => {
  const [result] = await db.query(
    `UPDATE products SET is_active = ? WHERE id = ?`,
    [is_active, id],
  );
  return result.affectedRows > 0;
};

export const findAll = async (
  { limit, offset, onlyActive = true },
  db = pool,
) => {
  const where = onlyActive ? "WHERE p.is_active = 1" : "";
  const [rows] = await db.query(
    `SELECT p.id, p.category_id, p.name, p.slug, p.best_price, p.is_active, p.created_at,
            COALESCE((
              SELECT SUM(i.stock_quantity)
              FROM product_variants v
              JOIN inventory i ON i.product_variant_id = v.id
              WHERE v.product_id = p.id AND v.is_active = 1
            ), 0) AS total_stock
     FROM products p
     ${where}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows;
};

export const countAll = async ({ onlyActive = true } = {}, db = pool) => {
  const where = onlyActive ? "WHERE is_active = 1" : "";
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM products ${where}`,
  );
  return rows[0].total;
};
