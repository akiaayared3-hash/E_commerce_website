import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";

/* =========================================================
   Constants
========================================================= */

const MAX_QUANTITY = 1_000_000;
const MAX_SEARCH_LENGTH = 100;
const MAX_PAGE_SIZE = 100;

// Must match the ENUM in inventory_movements (see inventory.sql).
const REASONS = new Set([
  "order",
  "cancel",
  "manual",
  "restock",
  "correction",
  "initial",
]);

// Allow-list: the filter name picks the SQL, user input is never concatenated.
const STOCK_FILTERS = {
  all: "",
  low: "AND i.stock_quantity > 0 AND i.stock_quantity <= i.low_stock_threshold",
  out: "AND i.stock_quantity = 0",
};

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

const idOf = (value, field = "variant ID") => {
  const number = toInt(value);

  if (number === null || number < 1) {
    throw new ApiError(400, `${field} must be a positive whole number`);
  }

  return number;
};

// Strictly positive: this is what stops negative "deductions" adding stock.
const quantityOf = (value, field = "quantity") => {
  const number = toInt(value);

  if (number === null || number < 1 || number > MAX_QUANTITY) {
    throw new ApiError(
      400,
      `${field} must be a whole number between 1 and ${MAX_QUANTITY}`,
    );
  }

  return number;
};

const nonNegativeOf = (value, field) => {
  const number = toInt(value);

  if (number === null || number < 0 || number > MAX_QUANTITY) {
    throw new ApiError(
      400,
      `${field} must be a whole number between 0 and ${MAX_QUANTITY}`,
    );
  }

  return number;
};

const pageOf = (limit, offset) => {
  const pageSize = toInt(limit);
  const start = toInt(offset ?? 0);

  if (pageSize === null || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ApiError(400, `limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  if (start === null || start < 0) {
    throw new ApiError(400, "offset must be zero or greater");
  }

  return { pageSize, start };
};

const normalizeSearch = (search) => {
  const value = typeof search === "string" ? search.trim() : "";

  if (value.length > MAX_SEARCH_LENGTH) {
    throw new ApiError(
      400,
      `Search must be at most ${MAX_SEARCH_LENGTH} characters`,
    );
  }

  // Escape LIKE wildcards so "%" and "_" typed by a user match literally.
  return value.replace(/[!%_]/g, "!$&");
};

const filterSql = (filter = "all") => {
  if (!Object.hasOwn(STOCK_FILTERS, filter)) {
    throw new ApiError(400, "filter must be one of: all, low, out");
  }

  return STOCK_FILTERS[filter];
};

const normalizeMeta = (meta = {}, fallbackReason) => {
  const reason = meta.reason ?? fallbackReason;

  if (!REASONS.has(reason)) {
    throw new ApiError(400, "Invalid stock movement reason");
  }

  const note =
    typeof meta.note === "string" && meta.note.trim()
      ? meta.note.trim().slice(0, 255)
      : null;

  return {
    reason,
    orderId: meta.orderId == null ? null : idOf(meta.orderId, "order ID"),
    userId: meta.userId == null ? null : idOf(meta.userId, "user ID"),
    note,
  };
};

// Merges duplicate variants, validates everything, and sorts by ID so every
// transaction locks rows in the same order (prevents deadlocks).
const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one stock item is required");
  }

  const totals = new Map();

  for (const item of items) {
    const variantId = idOf(item?.product_variant_id);
    const quantity = quantityOf(item?.quantity);

    totals.set(variantId, (totals.get(variantId) ?? 0) + quantity);
  }

  for (const quantity of totals.values()) {
    if (quantity > MAX_QUANTITY) {
      throw new ApiError(400, "Total quantity for one variant is too large");
    }
  }

  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
};

/* =========================================================
   Transaction helper
========================================================= */

const isConnection = (db) => typeof db?.release === "function";

// If the caller passes a connection, the caller owns the transaction (and must
// roll back when this throws). If the caller passes the pool, this opens its
// own transaction so a multi-item change is all-or-nothing.
const withTransaction = async (db, work) => {
  if (isConnection(db)) return work(db);

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Inventory rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    connection.release();
  }
};

/* =========================================================
   Audit trail
========================================================= */

// Call only after a successful stock UPDATE on the same connection: that
// UPDATE holds the row lock, so the stock read here is consistent.
const recordMovement = async (connection, variantId, delta, meta) => {
  const [rows] = await connection.query(
    `SELECT stock_quantity
     FROM inventory
     WHERE product_variant_id = ?`,
    [variantId],
  );

  await connection.query(
    `INSERT INTO inventory_movements
       (product_variant_id, delta, stock_after, reason, order_id, user_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      variantId,
      delta,
      Number(rows[0]?.stock_quantity) || 0,
      meta.reason,
      meta.orderId,
      meta.userId,
      meta.note,
    ],
  );
};

/* =========================================================
   Create and read
========================================================= */

export const insert = async (
  { product_variant_id, stock_quantity = 0, low_stock_threshold = 5 },
  db = pool,
) => {
  const variantId = idOf(product_variant_id);
  const stock = nonNegativeOf(stock_quantity, "stock_quantity");
  const threshold = nonNegativeOf(low_stock_threshold, "low_stock_threshold");

  const [result] = await db.query(
    `INSERT INTO inventory (product_variant_id, stock_quantity, low_stock_threshold)
     VALUES (?, ?, ?)`,
    [variantId, stock, threshold],
  );

  return result.insertId;
};

export const findByVariantId = async (product_variant_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT product_variant_id, stock_quantity, low_stock_threshold
     FROM inventory
     WHERE product_variant_id = ?`,
    [idOf(product_variant_id)],
  );

  return rows[0] ?? null;
};

/* =========================================================
   Locking (only meaningful on a connection inside a transaction)
========================================================= */

export const lockStockForVariants = async (variantIds, db = pool) => {
  if (!isConnection(db)) {
    throw new Error(
      "lockStockForVariants must be called with a transaction connection",
    );
  }

  if (!Array.isArray(variantIds) || variantIds.length === 0) return [];

  const ids = [...new Set(variantIds.map((id) => idOf(id)))].sort(
    (a, b) => a - b,
  );

  const placeholders = ids.map(() => "?").join(",");

  const [rows] = await db.query(
    `SELECT product_variant_id, stock_quantity
     FROM inventory
     WHERE product_variant_id IN (${placeholders})
     ORDER BY product_variant_id
     FOR UPDATE`,
    ids,
  );

  return rows;
};

/* =========================================================
   Low-level stock changes (no audit row; prefer the bulk/adjust
   functions below, which also write the movement log)
========================================================= */

// Succeeds only if enough stock remains: never oversells, never goes negative.
export const deductStock = async (product_variant_id, quantity, db = pool) => {
  const [result] = await db.query(
    `UPDATE inventory
     SET stock_quantity = stock_quantity - ?
     WHERE product_variant_id = ?
       AND stock_quantity >= ?`,
    [quantityOf(quantity), idOf(product_variant_id), quantity],
  );

  return result.affectedRows > 0;
};

// Used when an order is cancelled.
export const restoreStock = async (product_variant_id, quantity, db = pool) => {
  const [result] = await db.query(
    `UPDATE inventory
     SET stock_quantity = stock_quantity + ?
     WHERE product_variant_id = ?`,
    [quantityOf(quantity), idOf(product_variant_id)],
  );

  return result.affectedRows > 0;
};

/* =========================================================
   Audited stock changes
========================================================= */

// items: [{ product_variant_id, quantity }, ...]
// All-or-nothing. Throws ApiError(409) if any variant lacks stock.
export const deductStockBulk = async (items, db = pool, meta = {}) => {
  const entries = normalizeItems(items);
  const movement = normalizeMeta(meta, "order");

  return withTransaction(db, async (connection) => {
    for (const [variantId, quantity] of entries) {
      const ok = await deductStock(variantId, quantity, connection);

      if (!ok) {
        throw new ApiError(409, `Insufficient stock for variant ${variantId}`);
      }

      await recordMovement(connection, variantId, -quantity, movement);
    }

    return true;
  });
};

// Returns { missing: [variantId, ...] } for variants that no longer exist.
// Make the caller's order status change conditional (WHERE status = ...) in the
// same transaction so a double cancel cannot restore stock twice.
export const restoreStockBulk = async (items, db = pool, meta = {}) => {
  const entries = normalizeItems(items);
  const movement = normalizeMeta(meta, "cancel");

  return withTransaction(db, async (connection) => {
    const missing = [];

    for (const [variantId, quantity] of entries) {
      const ok = await restoreStock(variantId, quantity, connection);

      if (!ok) {
        console.error("Stock restore skipped: variant not found", {
          variantId,
        });
        missing.push(variantId);
        continue;
      }

      await recordMovement(connection, variantId, quantity, movement);
    }

    return { missing };
  });
};

// Change stock by a non-zero +/- delta. Returns false when the variant does
// not exist or the result would be below zero.
export const adjustStock = async (
  product_variant_id,
  delta,
  db = pool,
  meta = {},
) => {
  const variantId = idOf(product_variant_id);
  const change = toInt(delta);

  if (change === null || change === 0 || Math.abs(change) > MAX_QUANTITY) {
    throw new ApiError(
      400,
      `delta must be a non-zero whole number up to ${MAX_QUANTITY} either way`,
    );
  }

  const movement = normalizeMeta(meta, "manual");

  return withTransaction(db, async (connection) => {
    const ok =
      change < 0
        ? await deductStock(variantId, -change, connection)
        : await restoreStock(variantId, change, connection);

    if (!ok) return false;

    await recordMovement(connection, variantId, change, movement);

    return true;
  });
};

export const setLowStockThreshold = async (
  product_variant_id,
  threshold,
  db = pool,
) => {
  const [result] = await db.query(
    `UPDATE inventory
     SET low_stock_threshold = ?
     WHERE product_variant_id = ?`,
    [nonNegativeOf(threshold, "low_stock_threshold"), idOf(product_variant_id)],
  );

  return result.affectedRows > 0;
};

/* =========================================================
   Admin listing
========================================================= */

// One row per variant, lowest stock first. filter: "all" | "low" | "out".
export const listWithProducts = async (
  { limit, offset = 0, search = "", filter = "all" },
  db = pool,
) => {
  const { pageSize, start } = pageOf(limit, offset);
  const term = normalizeSearch(search);
  const like = `%${term}%`;

  const [rows] = await db.query(
    `SELECT i.product_variant_id,
            i.stock_quantity,
            i.low_stock_threshold,
            pv.sku,
            pv.name      AS variant_name,
            pv.size,
            pv.is_active AS variant_active,
            p.id         AS product_id,
            p.name       AS product_name,
            p.is_active  AS product_active
     FROM inventory i
     JOIN product_variants pv ON pv.id = i.product_variant_id
     JOIN products p          ON p.id  = pv.product_id
     WHERE (? = '' OR p.name LIKE ? ESCAPE '!' OR pv.sku LIKE ? ESCAPE '!')
       ${filterSql(filter)}
     ORDER BY i.stock_quantity ASC, p.name ASC, pv.id ASC
     LIMIT ? OFFSET ?`,
    [term, like, like, pageSize, start],
  );

  return rows;
};

export const countWithProducts = async (
  search = "",
  db = pool,
  filter = "all",
) => {
  const term = normalizeSearch(search);
  const like = `%${term}%`;

  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM inventory i
     JOIN product_variants pv ON pv.id = i.product_variant_id
     JOIN products p          ON p.id  = pv.product_id
     WHERE (? = '' OR p.name LIKE ? ESCAPE '!' OR pv.sku LIKE ? ESCAPE '!')
       ${filterSql(filter)}`,
    [term, like, like],
  );

  return Number(rows[0].total) || 0;
};

// Movement history for one variant, newest first.
export const listMovements = async (
  { product_variant_id, limit = 20, offset = 0 },
  db = pool,
) => {
  const { pageSize, start } = pageOf(limit, offset);

  const [rows] = await db.query(
    `SELECT id, product_variant_id, delta, stock_after, reason,
            order_id, user_id, note, created_at
     FROM inventory_movements
     WHERE product_variant_id = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [idOf(product_variant_id), pageSize, start],
  );

  return rows;
};

export const setStockByVariantId = async (
  variantId,
  stock_quantity,
  db = pool,
) => {
  const [result] = await db.query(
    `UPDATE inventory SET stock_quantity = ? WHERE product_variant_id = ?`,
    [stock_quantity, variantId],
  );
  if (result.affectedRows > 0) return true;
  // Row missing → insert
  await db.query(
    `INSERT INTO inventory (product_variant_id, stock_quantity) VALUES (?, ?)`,
    [variantId, stock_quantity],
  );
  return true;
};