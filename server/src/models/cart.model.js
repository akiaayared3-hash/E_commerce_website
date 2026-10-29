import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";

/* =========================================================
   Constants
========================================================= */

// Name of the table that stores product images (see upload.model.js).
// Expected columns: product_id, url, view_type, sort_order, id.
const IMAGE_TABLE = "product_images";

const MAX_ITEM_QUANTITY = 100;

/* =========================================================
   Validation helpers
========================================================= */

const toInt = (value) => {
  const number =
    typeof value === "string" && /^-?\d+$/.test(value.trim())
      ? Number(value)
      : value;

  return Number.isSafeInteger(number) ? number : null;
};

const idOf = (value, field) => {
  const number = toInt(value);

  if (number === null || number < 1) {
    throw new ApiError(400, `${field} must be a positive whole number`);
  }

  return number;
};

const quantityOf = (value) => {
  const number = toInt(value);

  if (number === null || number < 1 || number > MAX_ITEM_QUANTITY) {
    throw new ApiError(
      400,
      `Quantity must be a whole number between 1 and ${MAX_ITEM_QUANTITY}`,
    );
  }

  return number;
};

/* =========================================================
   Carts
========================================================= */

/**
 * Find or create a cart for a user. Returns the cart id.
 * Safe when two requests arrive at once if carts.user_id is UNIQUE.
 */
export const create = async (user_id, db = pool) => {
  const userId = idOf(user_id, "user ID");

  const [existing] = await db.query(
    `SELECT id FROM carts WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // If another request created the cart a moment ago, reuse it instead of failing.
  // LAST_INSERT_ID(id) makes insertId the real cart id in both cases.
  const [result] = await db.query(
    `INSERT INTO carts (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [userId],
  );

  return result.insertId;
};

/**
 * Find a user's cart (read-only, never creates one).
 * Returns { id, user_id } or null.
 */
export const findByUser = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, user_id FROM carts WHERE user_id = ? LIMIT 1`,
    [idOf(user_id, "user ID")],
  );

  return rows[0] ?? null;
};

/* =========================================================
   Cart items
========================================================= */

/**
 * Add an item, or increase its quantity if the variant is already in the cart.
 * The quantity is capped at MAX_ITEM_QUANTITY. Check stock in the service.
 * Needs UNIQUE (cart_id, product_variant_id) on cart_items.
 * Returns the cart item id (also when an existing row was updated).
 */
export const addItem = async (
  { cart_id, product_variant_id, quantity = 1 },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id),
       quantity = LEAST(quantity + VALUES(quantity), ?)`,
    [
      idOf(cart_id, "cart ID"),
      idOf(product_variant_id, "product variant ID"),
      quantityOf(quantity),
      MAX_ITEM_QUANTITY,
    ],
  );

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
    [idOf(cart_id, "cart ID"), idOf(product_variant_id, "product variant ID")],
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
  const params = [idOf(item_id, "item ID")];

  if (cart_id !== null) {
    query += ` AND cart_id = ?`;
    params.push(idOf(cart_id, "cart ID"));
  }

  const [rows] = await db.query(query, params);

  return rows[0] || null;
};

/**
 * Set the absolute quantity of an item. A quantity of 0 removes it.
 * Returns true when a row changed.
 */
export const setQuantity = async (item_id, cart_id, quantity, db = pool) => {
  const number = toInt(quantity);

  if (number === null || number < 0 || number > MAX_ITEM_QUANTITY) {
    throw new ApiError(
      400,
      `Quantity must be a whole number between 0 and ${MAX_ITEM_QUANTITY}`,
    );
  }

  if (number === 0) {
    return removeItem(item_id, cart_id, db);
  }

  const [result] = await db.query(
    `UPDATE cart_items
     SET quantity = ?
     WHERE id = ? AND cart_id = ?`,
    [number, idOf(item_id, "item ID"), idOf(cart_id, "cart ID")],
  );

  // affectedRows counts matched rows with the default mysql2 flags, so setting
  // the same quantity still returns true.
  return result.affectedRows > 0;
};

/**
 * Remove a single item from the cart
 */
export const removeItem = async (item_id, cart_id, db = pool) => {
  const [result] = await db.query(
    `DELETE FROM cart_items
     WHERE id = ? AND cart_id = ?`,
    [idOf(item_id, "item ID"), idOf(cart_id, "cart ID")],
  );

  return result.affectedRows > 0;
};

/**
 * Clear all items from a cart
 */
export const clear = async (cart_id, db = pool) => {
  const [result] = await db.query(`DELETE FROM cart_items WHERE cart_id = ?`, [
    idOf(cart_id, "cart ID"),
  ]);

  return result.affectedRows;
};

/**
 * List all items in a cart with product, variant, stock and image.
 * image_url is the raw stored value: pass it through buildProductImageUrl()
 * in the cart service before sending it to the browser.
 */
export const listItems = async (cart_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT
       ci.id            AS item_id,
       ci.quantity,
       v.id             AS variant_id,
       v.name           AS variant_name,
       v.sku,
       v.size,
       v.price,
       v.is_active      AS variant_active,
       p.id             AS product_id,
       p.name           AS product_name,
       p.slug,
       p.is_active      AS product_active,
       COALESCE(i.stock_quantity, 0) AS stock,
       (
         SELECT pi.url
         FROM ${IMAGE_TABLE} pi
         WHERE pi.product_id = p.id
         ORDER BY (pi.view_type = 'front') DESC, pi.sort_order ASC, pi.id ASC
         LIMIT 1
       ) AS image_url
     FROM cart_items ci
     JOIN product_variants v ON v.id = ci.product_variant_id
     JOIN products p         ON p.id = v.product_id
     LEFT JOIN inventory i   ON i.product_variant_id = v.id
     WHERE ci.cart_id = ?
     ORDER BY ci.id`,
    [idOf(cart_id, "cart ID")],
  );

  return rows;
};
