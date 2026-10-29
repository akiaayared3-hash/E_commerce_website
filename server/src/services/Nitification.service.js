// services/notification.service.js
// Assumes a mysql2/promise pool exported from ../config/db (adjust the path/name).
import { pool } from "../config/db.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

/**
 * Insert one notification. Throws on failure.
 * Pass a transaction `connection` if you want it inside the same transaction.
 */
async function createNotification(
  { type, title, message = "", entityType = null, entityId = null },
  connection = db,
) {
  const [result] = await connection.execute(
    `INSERT INTO notifications (type, title, message, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      String(type).slice(0, 50),
      String(title).slice(0, 150),
      String(message).slice(0, 500),
      entityType,
      entityId,
    ],
  );
  return result.insertId;
}

/**
 * Same as createNotification but NEVER throws.
 * Use this from order/customer flows so a notification problem can never
 * break the customer's request. Returns the new id, or null on failure.
 */
async function notifySafe(payload, connection = db) {
  try {
    return await createNotification(payload, connection);
  } catch (err) {
    console.error(
      "[notifications] could not create notification:",
      err.message,
    );
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Event helpers (one-liners to call from your controllers/services)   */
/* ------------------------------------------------------------------ */

const notifyNewOrder = ({ id, total, customerName = "A customer" }) =>
  notifySafe({
    type: "new_order",
    title: `New order #${id}`,
    message: `${customerName} placed an order${
      total != null ? ` totaling ${Number(total).toFixed(2)}` : ""
    }.`,
    entityType: "order",
    entityId: id,
  });

const notifyPaymentReceived = ({ orderId, amount }) =>
  notifySafe({
    type: "payment_received",
    title: `Payment received for order #${orderId}`,
    message:
      amount != null
        ? `Payment of ${Number(amount).toFixed(2)} was confirmed.`
        : "Payment was confirmed.",
    entityType: "order",
    entityId: orderId,
  });

const notifyLowStock = ({ id, name, stock }) =>
  notifySafe({
    type: "low_stock",
    title: "Low stock",
    message: `${name} has only ${stock} left.`,
    entityType: "product",
    entityId: id,
  });

const notifyNewCustomer = ({ id, name }) =>
  notifySafe({
    type: "new_customer",
    title: "New customer registered",
    message: `${name || "A new customer"} just signed up.`,
    entityType: "user",
    entityId: id,
  });

const notifyContactMessage = ({ id, name, subject }) =>
  notifySafe({
    type: "contact_message",
    title: "New message from a customer",
    message: `${name || "A customer"}: ${subject || "sent you a message"}`,
    entityType: "message",
    entityId: id,
  });

/* ------------------------------------------------------------------ */
/* Read / update / delete (used by the admin routes)                   */
/* ------------------------------------------------------------------ */

async function listNotifications(limit) {
  const parsed = parseInt(limit, 10);
  const safeLimit = Math.min(
    Math.max(Number.isNaN(parsed) ? DEFAULT_LIMIT : parsed, 1),
    MAX_LIMIT,
  );

  // db.query (not execute) because some mysql2 versions reject a placeholder in LIMIT.
  const [rows] = await db.query(
    `SELECT id, type, title, message, entity_type, entity_id, is_read, created_at
       FROM notifications
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [safeLimit],
  );

  const [[{ unreadCount }]] = await db.query(
    "SELECT COUNT(*) AS unreadCount FROM notifications WHERE is_read = 0",
  );

  return {
    notifications: rows.map((row) => ({
      ...row,
      is_read: Boolean(row.is_read),
    })),
    unreadCount,
  };
}

/** Returns true if the notification exists (idempotent: already-read is fine). */
async function markAsRead(id) {
  const [result] = await db.execute(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND is_read = 0",
    [id],
  );
  if (result.affectedRows > 0) return true;

  const [rows] = await db.execute("SELECT 1 FROM notifications WHERE id = ?", [
    id,
  ]);
  return rows.length > 0;
}

async function markAllAsRead() {
  const [result] = await db.execute(
    "UPDATE notifications SET is_read = 1 WHERE is_read = 0",
  );
  return result.affectedRows;
}

async function clearAll() {
  const [result] = await db.execute("DELETE FROM notifications");
  return result.affectedRows;
}

/** Optional housekeeping: delete READ notifications older than N days. */
async function purgeOldRead(days = 60) {
  const [result] = await db.execute(
    "DELETE FROM notifications WHERE is_read = 1 AND created_at < (NOW() - INTERVAL ? DAY)",
    [Number(days)],
  );
  return result.affectedRows;
}

export {
  createNotification,
  notifySafe,
  notifyNewOrder,
  notifyPaymentReceived,
  notifyLowStock,
  notifyNewCustomer,
  notifyContactMessage,
  listNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
  purgeOldRead,
};
