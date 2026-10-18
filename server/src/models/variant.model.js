import { pool } from "../config/db.js";

export const findByProductId = async (product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT v.id, v.product_id, v.sku, v.name, v.price, v.is_active,
            i.stock_quantity, i.low_stock_threshold
     FROM product_variants v
     LEFT JOIN inventory i ON i.product_variant_id = v.id
     WHERE v.product_id = ?
     ORDER BY v.id`,
    [product_id],
  );
  return rows;
};

export const insert = async (
  { product_id, sku, name, price, is_active = true },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO product_variants (product_id, sku, name, price, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [product_id, sku, name, price, is_active],
  );
  return result.insertId;
};
