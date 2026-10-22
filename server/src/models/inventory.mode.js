import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";

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


export const lockStockForVariants = async (variantIds, db = pool) => {
  if (!variantIds || variantIds.length === 0) return [];

  const placeholders = variantIds.map(() => "?").join(",");

  const [rows] = await db.query(
    `SELECT product_variant_id, stock_quantity
     FROM inventory
     WHERE product_variant_id IN (${placeholders})
     ORDER BY product_variant_id
     FOR UPDATE`,
    variantIds,
  );
  return rows;
};

// Succeeds only if enough stock remains (no overselling, never negative)
export const deductStock = async (product_variant_id, quantity, db = pool) => {
  const [result] = await db.query(
    `UPDATE inventory
     SET stock_quantity = stock_quantity - ?
     WHERE product_variant_id = ?
       AND stock_quantity >= ?`,
    [quantity, product_variant_id, quantity],
  );
  return result.affectedRows > 0;
};

// items: [{ product_variant_id, quantity }, ...]
export const deductStockBulk = async (items, db = pool) => {
  const sorted = [...items].sort(
    (a, b) => a.product_variant_id - b.product_variant_id,
  );

  for (const item of sorted) {
    const ok = await deductStock(item.product_variant_id, item.quantity, db);
    if (!ok) {
      throw new ApiError(
        409,
        `Insufficient stock for variant ${item.product_variant_id}`,
      );
    }
  }
  return true;
};

// Used when an order is cancelled
export const restoreStock = async (product_variant_id, quantity, db = pool) => {
  const [result] = await db.query(
    `UPDATE inventory
     SET stock_quantity = stock_quantity + ?
     WHERE product_variant_id = ?`,
    [quantity, product_variant_id],
  );
  return result.affectedRows > 0;
};

export const restoreStockBulk = async (items, db = pool) => {
  const sorted = [...items].sort(
    (a, b) => a.product_variant_id - b.product_variant_id,
  );

  for (const item of sorted) {
    await restoreStock(item.product_variant_id, item.quantity, db);
  }
  return true;
};
