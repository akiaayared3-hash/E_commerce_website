import { pool } from "../config/db.js";

export const insert = async (
  { product_variant_id, stock_quantity = 0, low_stock_threshold = 5 },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO inventory (product_variant_id, stock_quantity, low_stock_threshold)
     VALUES (?, ?, ?)`,
    [product_variant_id, stock_quantity, low_stock_threshold],
  );
  return result.insertId;
};
