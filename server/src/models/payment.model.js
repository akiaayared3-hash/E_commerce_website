
// server/src/models/payment.model.js
import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";

/* =========================================================
   Constants
========================================================= */

const PAYMENT_STATUSES = new Set([
  "pending",
  "completed",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "needs_review",
]);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const PAYMENT_COLUMNS = `
  id,
  order_id,
  tx_ref,
  payment_gateway,
  transaction_id,
  amount,
  currency,
  status,
  failure_reason,
  gateway_response,
  paid_at,
  created_at,
  updated_at
`;

/* =========================================================
   Helpers
========================================================= */

const getDb = (db = pool) => db;

const normalizeId = (value, field = "id") => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, `Invalid ${field}`);
  }

  return id;
};

const normalizeTxRef = (value) => {
  if (typeof value !== "string") {
    throw new ApiError(400, "Invalid transaction reference");
  }

  const txRef = value.trim();

  if (!txRef || txRef.length > 100) {
    throw new ApiError(400, "Invalid transaction reference");
  }

  return txRef;
};

const normalizeMoney = (value, field = "amount") => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, `Invalid payment ${field}`);
  }

  // The database stores DECIMAL(10,2).
  if (Math.round(amount * 100) / 100 !== amount) {
    throw new ApiError(400, `Payment ${field} must have at most 2 decimals`);
  }

  if (amount >= 100000000) {
    throw new ApiError(400, `Payment ${field} exceeds the allowed range`);
  }

  return amount.toFixed(2);
};

const normalizeCurrency = (value = "ETB") => {
  if (typeof value !== "string") {
    throw new ApiError(400, "Invalid payment currency");
  }

  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ApiError(400, "Currency must be a 3-letter code");
  }

  return currency;
};

const normalizeGateway = (value) => {
  if (typeof value !== "string") {
    throw new ApiError(400, "Invalid payment gateway");
  }

  const gateway = value.trim().toLowerCase();

  if (!gateway || gateway.length > 50) {
    throw new ApiError(400, "Invalid payment gateway");
  }

  return gateway;
};

const normalizeLimit = (value = DEFAULT_LIMIT) => {
  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(limit, MAX_LIMIT);
};

const normalizeOffset = (value = 0) => {
  const offset = Number(value);

  if (!Number.isSafeInteger(offset) || offset < 0) {
    return 0;
  }

  return offset;
};

/**
 * Serialize gateway responses before storing them as JSON.
 * Avoid passing undefined or unserializable values to MySQL.
 */
const normalizeGatewayResponse = (value) => {
  if (value == null) return null;

  try {
    const json = JSON.stringify(value);

    if (json === undefined) {
      throw new Error("Gateway response is not serializable");
    }

    return json;
  } catch {
    throw new ApiError(400, "Invalid gateway response");
  }
};

const affectedRows = (result) => Number(result?.affectedRows ?? 0);

/**
 * Only permit the explicit database connection supplied by a service
 * transaction, otherwise use the application connection pool.
 */
const queryRows = async (sql, params = [], db = pool) => {
  const [rows] = await getDb(db).query(sql, params);
  return rows;
};

/* =========================================================
   Create payment
========================================================= */

/**
 * Creates a pending payment.
 *
 * Pass a transaction connection when this operation must participate
 * in an existing transaction.
 *
 * Returns the inserted payment ID.
 */
export const insert = async (
  {
    order_id,
    tx_ref,
    payment_gateway,
    amount,
    currency = "ETB",
  },
  db = pool,
) => {
  const orderId = normalizeId(order_id, "order ID");
  const transactionRef = normalizeTxRef(tx_ref);
  const gateway = normalizeGateway(payment_gateway);
  const paymentAmount = normalizeMoney(amount);
  const paymentCurrency = normalizeCurrency(currency);

  const [result] = await getDb(db).execute(
    `
      INSERT INTO payments (
        order_id,
        tx_ref,
        payment_gateway,
        amount,
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?, 'pending')
    `,
    [
      orderId,
      transactionRef,
      gateway,
      paymentAmount,
      paymentCurrency,
    ],
  );

  return result.insertId;
};

/* =========================================================
   Find payment
========================================================= */

export const findById = async (id, db = pool) => {
  const paymentId = normalizeId(id, "payment ID");

  const rows = await queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE id = ?
      LIMIT 1
    `,
    [paymentId],
    db,
  );

  return rows[0] ?? null;
};

export const findByTxRef = async (tx_ref, db = pool) => {
  const transactionRef = normalizeTxRef(tx_ref);

  const rows = await queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE tx_ref = ?
      LIMIT 1
    `,
    [transactionRef],
    db,
  );

  return rows[0] ?? null;
};

/**
 * Must be called inside a transaction when row locking is required.
 */
export const findByTxRefForUpdate = async (tx_ref, db) => {
  if (!db || typeof db.execute !== "function") {
    throw new Error(
      "findByTxRefForUpdate requires a transaction connection",
    );
  }

  const transactionRef = normalizeTxRef(tx_ref);

  const rows = await queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE tx_ref = ?
      LIMIT 1
      FOR UPDATE
    `,
    [transactionRef],
    db,
  );

  return rows[0] ?? null;
};

export const findByIdForUpdate = async (id, db) => {
  if (!db || typeof db.execute !== "function") {
    throw new Error("findByIdForUpdate requires a transaction connection");
  }

  const paymentId = normalizeId(id, "payment ID");

  const rows = await queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [paymentId],
    db,
  );

  return rows[0] ?? null;
};

/* =========================================================
   Order payment lookups
========================================================= */

/**
 * The generated unique completed_order_id column in your schema
 * prevents more than one completed payment per order.
 */
export const findCompletedByOrder = async (order_id, db = pool) => {
  const orderId = normalizeId(order_id, "order ID");

  const rows = await queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE order_id = ?
        AND status = 'completed'
      ORDER BY paid_at DESC, id DESC
      LIMIT 1
    `,
    [orderId],
    db,
  );

  return rows[0] ?? null;
};

export const findByOrder = async (
  order_id,
  { status = null, limit = DEFAULT_LIMIT, offset = 0 } = {},
  db = pool,
) => {
  const orderId = normalizeId(order_id, "order ID");
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const conditions = ["order_id = ?"];
  const params = [orderId];

  if (status != null) {
    if (!PAYMENT_STATUSES.has(status)) {
      throw new ApiError(400, "Invalid payment status");
    }

    conditions.push("status = ?");
    params.push(status);
  }

  params.push(safeLimit, safeOffset);

  return queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    params,
    db,
  );
};

/* =========================================================
   Internal status update
========================================================= */

const updatePendingPayment = async (
  id,
  {
    status,
    transaction_id = null,
    failure_reason = null,
    gateway_response = null,
    setPaidAt = false,
  },
  db = pool,
) => {
  const paymentId = normalizeId(id, "payment ID");

  if (!PAYMENT_STATUSES.has(status)) {
    throw new ApiError(400, "Invalid payment status");
  }

  if (
    transaction_id != null &&
    (typeof transaction_id !== "string" || transaction_id.length > 255)
  ) {
    throw new ApiError(400, "Invalid gateway transaction ID");
  }

  if (
    failure_reason != null &&
    (typeof failure_reason !== "string" || failure_reason.length > 255)
  ) {
    throw new ApiError(400, "Invalid payment failure reason");
  }

  const gatewayResponse = normalizeGatewayResponse(gateway_response);

  const [result] = await getDb(db).execute(
    `
      UPDATE payments
      SET
        status = ?,
        transaction_id = COALESCE(?, transaction_id),
        failure_reason = ?,
        gateway_response = COALESCE(?, gateway_response),
        paid_at = CASE
          WHEN ? = 1 THEN COALESCE(paid_at, CURRENT_TIMESTAMP)
          ELSE paid_at
        END
      WHERE id = ?
        AND status = 'pending'
    `,
    [
      status,
      transaction_id,
      failure_reason,
      gatewayResponse,
      setPaidAt ? 1 : 0,
      paymentId,
    ],
  );

  return affectedRows(result) === 1;
};

/* =========================================================
   Payment status transitions
========================================================= */

/**
 * Mark completed only from pending.
 *
 * The caller should update the corresponding order in the same
 * transaction. A unique-key violation is intentionally allowed to
 * propagate so the transaction can roll back.
 */
export const markCompleted = async (
  id,
  {
    transaction_id = null,
    gateway_response = null,
  } = {},
  db = pool,
) => {
  return updatePendingPayment(
    id,
    {
      status: "completed",
      transaction_id,
      failure_reason: null,
      gateway_response,
      setPaidAt: true,
    },
    db,
  );
};

export const markFailed = async (
  id,
  {
    transaction_id = null,
    failure_reason = "Payment failed",
    gateway_response = null,
  } = {},
  db = pool,
) => {
  return updatePendingPayment(
    id,
    {
      status: "failed",
      transaction_id,
      failure_reason,
      gateway_response,
    },
    db,
  );
};

export const markCancelled = async (
  id,
  {
    failure_reason = "Payment cancelled",
    gateway_response = null,
  } = {},
  db = pool,
) => {
  return updatePendingPayment(
    id,
    {
      status: "cancelled",
      failure_reason,
      gateway_response,
    },
    db,
  );
};

export const markExpired = async (
  id,
  {
    failure_reason = "Payment expired",
    gateway_response = null,
  } = {},
  db = pool,
) => {
  return updatePendingPayment(
    id,
    {
      status: "expired",
      failure_reason,
      gateway_response,
    },
    db,
  );
};

export const markRefunded = async (
  id,
  {
    transaction_id = null,
    failure_reason = null,
    gateway_response = null,
  } = {},
  db = pool,
) => {
  const paymentId = normalizeId(id, "payment ID");
  const gatewayResponse = normalizeGatewayResponse(gateway_response);

  if (
    transaction_id != null &&
    (typeof transaction_id !== "string" || transaction_id.length > 255)
  ) {
    throw new ApiError(400, "Invalid gateway transaction ID");
  }

  if (
    failure_reason != null &&
    (typeof failure_reason !== "string" || failure_reason.length > 255)
  ) {
    throw new ApiError(400, "Invalid payment failure reason");
  }

  const [result] = await getDb(db).execute(
    `
      UPDATE payments
      SET
        status = 'refunded',
        transaction_id = COALESCE(?, transaction_id),
        failure_reason = ?,
        gateway_response = COALESCE(?, gateway_response)
      WHERE id = ?
        AND status = 'completed'
    `,
    [transaction_id, failure_reason, gatewayResponse, paymentId],
  );

  return affectedRows(result) === 1;
};

/**
 * Your service uses this when a gateway reports successful payment,
 * but the payment cannot safely be applied to the order.
 *
 * IMPORTANT: the supplied payments table enum must include
 * 'needs_review' before this method can be used.
 */
export const markNeedsReview = async (
  id,
  {
    transaction_id = null,
    failure_reason = "Payment requires manual review",
    gateway_response = null,
  } = {},
  db = pool,
) => {
  const paymentId = normalizeId(id, "payment ID");

  if (
    transaction_id != null &&
    (typeof transaction_id !== "string" || transaction_id.length > 255)
  ) {
    throw new ApiError(400, "Invalid gateway transaction ID");
  }

  if (
    typeof failure_reason !== "string" ||
    failure_reason.length > 255
  ) {
    throw new ApiError(400, "Invalid payment review reason");
  }

  const gatewayResponse = normalizeGatewayResponse(gateway_response);

  const [result] = await getDb(db).execute(
    `
      UPDATE payments
      SET
        status = 'needs_review',
        transaction_id = COALESCE(?, transaction_id),
        failure_reason = ?,
        gateway_response = COALESCE(?, gateway_response)
      WHERE id = ?
        AND status = 'pending'
    `,
    [
      transaction_id,
      failure_reason,
      gatewayResponse,
      paymentId,
    ],
  );

  return affectedRows(result) === 1;
};

/* =========================================================
   Admin listing and counts
========================================================= */

const normalizeOptionalStatus = (status) => {
  if (status == null || status === "") return null;

  if (typeof status !== "string" || !PAYMENT_STATUSES.has(status)) {
    throw new ApiError(400, "Invalid payment status");
  }

  return status;
};

export const findAll = async ({
  status = null,
  limit = DEFAULT_LIMIT,
  offset = 0,
} = {}, db = pool) => {
  const safeStatus = normalizeOptionalStatus(status);
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);

  const conditions = [];
  const params = [];

  if (safeStatus) {
    conditions.push("status = ?");
    params.push(safeStatus);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  params.push(safeLimit, safeOffset);

  return queryRows(
    `
      SELECT ${PAYMENT_COLUMNS}
      FROM payments
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    params,
    db,
  );
};

export const countAll = async ({ status = null } = {}, db = pool) => {
  const safeStatus = normalizeOptionalStatus(status);

  const conditions = [];
  const params = [];

  if (safeStatus) {
    conditions.push("status = ?");
    params.push(safeStatus);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const rows = await queryRows(
    `
      SELECT COUNT(*) AS total
      FROM payments
      ${where}
    `,
    params,
    db,
  );

  return Number(rows[0]?.total ?? 0);
};
