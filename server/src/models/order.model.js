import { pool } from "../config/db.js";

const ORDER_COLUMNS = `id, user_id, shipping_address_id, total_amount, order_status, created_at, updated_at`;

// ---------- orders ----------

export const insert = async (
  { user_id, shipping_address_id, total_amount, order_status = "pending" },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO orders (user_id, shipping_address_id, total_amount, order_status)
     VALUES (?, ?, ?, ?)`,
    [user_id, shipping_address_id, total_amount, order_status],
  );
  return result.insertId;
};

export const findById = async (order_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ?`,
    [order_id],
  );
  return rows[0] ?? null;
};

// ownership is checked in SQL: returns null if the order is not this user's
export const findByIdAndUser = async (order_id, user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ? AND user_id = ?`,
    [order_id, user_id],
  );
  return rows[0] ?? null;
};

export const findByUser = async (
  user_id,
  { limit = 10, offset = 0 } = {},
  db = pool,
) => {
  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS}
     FROM orders
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [user_id, limit, offset],
  );
  return rows;
};

export const countByUser = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM orders WHERE user_id = ?`,
    [user_id],
  );
  return rows[0].total;
};

// admin: all orders, optional status filter
export const findAll = async (
  { status = null, limit = 10, offset = 0 } = {},
  db = pool,
) => {
  const where = status ? `WHERE order_status = ?` : ``;
  const params = status ? [status, limit, offset] : [limit, offset];

  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS}
     FROM orders
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    params,
  );
  return rows;
};

export const countAll = async ({ status = null } = {}, db = pool) => {
  const where = status ? `WHERE order_status = ?` : ``;
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM orders ${where}`,
    status ? [status] : [],
  );
  return rows[0].total;
};

// Moves an order from one status to another ONLY if it is still in the expected status.
// Returns false if someone else changed it first (prevents double cancel, cancel + ship, etc.)
export const transitionStatus = async (
  order_id,
  from_status,
  to_status,
  db = pool,
) => {
  const [result] = await db.query(
    `UPDATE orders
     SET order_status = ?
     WHERE id = ? AND order_status = ?`,
    [to_status, order_id, from_status],
  );
  return result.affectedRows > 0;
};

// ---------- order_items ----------

// items: [{ order_id, product_variant_id, quantity, unit_price }, ...]
export const insertItems = async (items, db = pool) => {
  if (!items || items.length === 0) return 0;

  const values = items.map((item) => [
    item.order_id,
    item.product_variant_id,
    item.quantity,
    item.unit_price,
  ]);

  const [result] = await db.query(
    `INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price)
     VALUES ?`,
    [values],
  );
  return result.affectedRows;
};

export const listByOrderId = async (order_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       oi.id,
       oi.order_id,
       oi.product_variant_id,
       oi.quantity,
       oi.unit_price,
       oi.created_at,
       v.name AS variant_name,
       v.sku,
       p.name AS product_name,
       p.slug
     FROM order_items oi
     JOIN product_variants v ON v.id = oi.product_variant_id
     JOIN products p ON p.id = v.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id`,
    [order_id],
  );
  return rows;
};
