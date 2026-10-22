import { pool } from "../config/db.js";

/**
 * Find or create a cart for a user.
 * Returns the cart id.
 */
export const create = async (user_id, db = pool) => {
  // First try to find an existing cart
  const [existing] = await db.query(
    `SELECT id FROM carts WHERE user_id = ? LIMIT 1`,
    [user_id],
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create a new cart
  const [result] = await db.query(`INSERT INTO carts (user_id) VALUES (?)`, [
    user_id,
  ]);

  return result.insertId;
};

/**
 * Add an item to the cart (or increase quantity if it already exists)
 */
export const addItem = async (
  { cart_id, product_variant_id, quantity = 1 },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [cart_id, product_variant_id, quantity],
  );

  // With ON DUPLICATE KEY, insertId is the existing row's id
  return result.insertId;
};

/**
 * Find a specific item in a cart by cart_id + product_variant_id
 */
export const findItem = async (cart_id, product_variant_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, cart_id, product_variant_id, quantity
     FROM cart_items
     WHERE cart_id = ? AND product_variant_id = ?`,
    [cart_id, product_variant_id],
  );

  return rows[0] || null;
};

/**
 * Find a cart item by its own id (and optionally verify it belongs to the cart)
 */
export const findItemById = async (item_id, cart_id = null, db = pool) => {
  let query = `SELECT id, cart_id, product_variant_id, quantity
               FROM cart_items
               WHERE id = ?`;
  const params = [item_id];

  if (cart_id !== null) {
    query += ` AND cart_id = ?`;
    params.push(cart_id);
  }

  const [rows] = await db.query(query, params);
  return rows[0] || null;
};

/**
 * Set absolute quantity of an item
 */
export const setQuantity = async (item_id, cart_id, quantity, db = pool) => {
  if (quantity <= 0) {
    // Optional: treat 0 or negative as delete
    return removeItem(item_id, cart_id, db);
  }

  const [result] = await db.query(
    `UPDATE cart_items
     SET quantity = ?
     WHERE id = ? AND cart_id = ?`,
    [quantity, item_id, cart_id],
  );

  return result.affectedRows > 0;
};

/**
 * Remove a single item from the cart
 */
export const removeItem = async (item_id, cart_id, db = pool) => {
  const [result] = await db.query(
    `DELETE FROM cart_items
     WHERE id = ? AND cart_id = ?`,
    [item_id, cart_id],
  );

  return result.affectedRows > 0;
};

/**
 * Clear all items from a cart
 */
export const clear = async (cart_id, db = pool) => {
  const [result] = await db.query(`DELETE FROM cart_items WHERE cart_id = ?`, [
    cart_id,
  ]);

  return result.affectedRows;
};

/**
 * List all items in a cart with product + variant + stock info
 */
export const listItems = async (cart_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       ci.id            AS item_id,
       ci.quantity,
       v.id             AS variant_id,
       v.name           AS variant_name,
       v.sku,
       v.price,
       v.is_active      AS variant_active,
       p.id             AS product_id,
       p.name           AS product_name,
       p.slug,
       p.is_active      AS product_active,
       COALESCE(i.stock_quantity, 0) AS stock
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.product_variant_id
     JOIN products p         ON p.id = v.product_id
     LEFT JOIN inventory i   ON i.product_variant_id = v.id
     WHERE ci.cart_id = ?
     ORDER BY ci.id`,
    [cart_id],
  );

  return rows;
};
