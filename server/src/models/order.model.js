// models/order.model.js
import { pool } from "../config/db.js";

const ORDER_COLUMNS = `id, user_id, shipping_address_id,
  shipping_full_name, shipping_phone, shipping_region, shipping_city,
  shipping_sub_city, shipping_woreda, shipping_street, shipping_landmark,
  total_amount, payment_method, order_status, created_at, updated_at`;

// Lists also get a cheap line count so the UI can show "3 items"
// without loading every order's items.
const LIST_COLUMNS = `${ORDER_COLUMNS},
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = orders.id) AS item_count`;

// ---------- carts ----------

/**
 * Locks the user's cart row. MUST be the first statement of the checkout
 * transaction: a second checkout request from the same user waits here until
 * the first one has committed (and emptied the cart), so a double-click can
 * never create two orders from the same cart.
 *
 * Assumes table `carts` with a `user_id` column. Adjust if yours differs.
 */
export const lockCartForUser = async (user_id, db) => {
  const [rows] = await db.query(
    `SELECT id FROM carts WHERE user_id = ? FOR UPDATE`,
    [user_id],
  );
  return rows[0] ?? null;
};

// ---------- orders ----------

export const insert = async (
  {
    user_id,
    shipping_address_id,
    shipping_full_name,
    shipping_phone,
    shipping_region,
    shipping_city,
    shipping_sub_city = null,
    shipping_woreda = null,
    shipping_street = null,
    shipping_landmark = null,
    total_amount,
    payment_method = "cod",
    order_status = "pending",
  },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO orders
       (user_id, shipping_address_id,
        shipping_full_name, shipping_phone, shipping_region, shipping_city,
        shipping_sub_city, shipping_woreda, shipping_street, shipping_landmark,
        total_amount, payment_method, order_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      shipping_address_id,
      shipping_full_name,
      shipping_phone,
      shipping_region,
      shipping_city,
      shipping_sub_city,
      shipping_woreda,
      shipping_street,
      shipping_landmark,
      total_amount,
      payment_method,
      order_status,
    ],
  );
  return result.insertId;
};


export const findByIdForUpdate = async (order_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ORDER_COLUMNS}
     FROM orders
     WHERE id = ?
     FOR UPDATE`,
    [order_id],
  );

  return rows[0] ?? null;
};


// Ownership is checked in SQL: returns null if the order is not this user's.
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
    `SELECT ${LIST_COLUMNS}
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

// Admin: all orders, optional status filter.
export const findAll = async (
  { status = null, limit = 10, offset = 0 } = {},
  db = pool,
) => {
  const where = status ? `WHERE order_status = ?` : ``;
  const params = status ? [status, limit, offset] : [limit, offset];

  const [rows] = await db.query(
    `SELECT ${LIST_COLUMNS}
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

// Used by the expiry job.
// Cash-on-delivery orders are NEVER expired: they are unpaid by design and
// wait for the shop to confirm them.
export const findStalePending = async (minutes = 30, db = pool) => {
  const [rows] = await db.query(
    `SELECT id FROM orders
     WHERE order_status = 'pending'
       AND payment_method <> 'cod'
       AND created_at < (NOW() - INTERVAL ? MINUTE)
     ORDER BY id
     LIMIT 100`,
    [Number(minutes)],
  );
  return rows;
};

// Moves an order from one status to another ONLY if it is still in the
// expected status. Returns false if someone else changed it first
// (prevents double cancel, cancel + ship, etc.).
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
