// services/payment.service.js
import * as paymentModel from "../models/payment.model.js";
import * as orderModel from "../models/order.model.js";
import {
  PAYMENT_GATEWAY,
  DEFAULT_CURRENCY,
  generateTxRef,
  initializePayment,
  verifyTransaction,
  verifyWebhookSignature,
} from "../utils/payments.util.js";
import { ApiError } from "../utils/apiError.util.js";
import { withTransaction } from "../utils/transaction.util.js";

// ---------- constants ----------

export const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled", // closed because its order was cancelled
  EXPIRED: "expired", // closed because its order expired unpaid
  REFUNDED: "refunded",
  // Money was received but the order cannot use it
  // (cancelled order, duplicate payment, amount mismatch…)
  NEEDS_REVIEW: "needs_review",
};

export const PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

// Local copies to avoid circular import with order.service
const ORDER_PENDING = "pending";
const ORDER_PAID = "paid";
const ORDER_CANCELLED = "cancelled";

// ---------- helpers ----------

const toCents = (value) => Math.round(Number(value) * 100);
const sameMoney = (a, b) => toCents(a) === toCents(b);
const sameCurrency = (a, b) =>
  String(a ?? "").toUpperCase() === String(b ?? "").toUpperCase();

const parsePaging = ({ limit = 20, offset = 0 } = {}) => ({
  limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
  offset: Math.max(Number(offset) || 0, 0),
});

const flagForReview = async (payment, verification, reason, conn) => {
  await paymentModel.markNeedsReview(
    payment.id,
    {
      transaction_id: verification.transaction_id ?? null,
      failure_reason: reason,
      gateway_response: verification.raw,
    },
    conn,
  );

  // Replace with your real logger / alerting
  console.warn(
    `[payment] needs_review payment=${payment.id} order=${payment.order_id} reason=${reason}`,
  );

  return { handled: true, reason };
};

/**
 * Single place where a gateway verification result is applied.
 * Used by both webhook and status endpoint.
 * Always runs inside a DB transaction. Safe to call many times.
 */
const applyVerification = async (tx_ref, verification, conn) => {
  // 1. Lock the payment row
  const payment = await paymentModel.findByTxRefForUpdate(tx_ref, conn);
  if (!payment) return { handled: false, reason: "payment_not_found" };

  if (payment.status !== PAYMENT_STATUS.PENDING) {
    return { handled: true, reason: "already_processed", payment };
  }

  // 2. Gateway must be talking about the same reference
  if (verification.tx_ref && verification.tx_ref !== tx_ref) {
    throw new ApiError(502, "Gateway returned a different transaction");
  }

  // 3. Definitive failure
  if (verification.status === "failed") {
    await paymentModel.markFailed(
      payment.id,
      {
        failure_reason: "Gateway reported failed",
        gateway_response: verification.raw,
      },
      conn,
    );
    return { handled: true, reason: "failed", payment };
  }

  if (verification.status !== "success") {
    return { handled: true, reason: "still_pending", payment };
  }

  // 4. Money arrived – amount & currency must match
  if (
    !sameMoney(verification.amount, payment.amount) ||
    !sameCurrency(verification.currency, payment.currency)
  ) {
    return flagForReview(payment, verification, "amount_mismatch", conn);
  }

  // 5. Lock the order and decide what the money means
  const order = await orderModel.findByIdForUpdate(payment.order_id, conn);
  if (!order) {
    return flagForReview(payment, verification, "order_not_found", conn);
  }

  if (order.order_status === ORDER_CANCELLED) {
    return flagForReview(
      payment,
      verification,
      "order_cancelled_before_payment",
      conn,
    );
  }

  if (order.order_status !== ORDER_PENDING) {
    // Already paid or further along → duplicate payment
    return flagForReview(payment, verification, "duplicate_payment", conn);
  }

  // 6. Happy path
  const updated = await paymentModel.markCompleted(
    payment.id,
    {
      transaction_id: verification.transaction_id,
      gateway_response: verification.raw,
    },
    conn,
  );
  if (!updated) {
    return { handled: true, reason: "already_processed", payment };
  }

  const moved = await orderModel.transitionStatus(
    order.id,
    ORDER_PENDING,
    ORDER_PAID,
    conn,
  );
  if (!moved) {
    // Should not happen under the row lock
    throw new ApiError(409, "Order status changed during payment");
  }

  return { handled: true, reason: "completed", payment };
};

// ---------- start payment ----------

/**
 * Called after the order exists (status = pending) and stock is deducted.
 * Amount is always read from the database – never trusted from the caller.
 */
export const startPayment = async ({
  order_id,
  amount, // optional sanity check only
  currency = DEFAULT_CURRENCY,
  customer, // { email, first_name, last_name, phone_number }
  callback_url,
  return_url,
}) => {
  const tx_ref = generateTxRef();

  // 1. Validate order + create payment row (short transaction, no network)
  const { paymentId, payable } = await withTransaction(async (conn) => {
    const order = await orderModel.findByIdForUpdate(order_id, conn);
    if (!order) throw new ApiError(404, "Order not found");

    if (order.order_status !== ORDER_PENDING) {
      throw new ApiError(
        409,
        `Order is "${order.order_status}" and cannot be paid`,
      );
    }

    if (amount != null && !sameMoney(amount, order.total_amount)) {
      throw new ApiError(400, "Amount does not match the order total");
    }

    const alreadyPaid = await paymentModel.findCompletedByOrder(order_id, conn);
    if (alreadyPaid) {
      throw new ApiError(409, "This order has already been paid");
    }

    const id = await paymentModel.insert(
      {
        order_id,
        tx_ref,
        payment_gateway: PAYMENT_GATEWAY,
        amount: order.total_amount,
        currency,
      },
      conn,
    );

    return { paymentId: id, payable: order.total_amount };
  });

  // 2. Call the gateway outside the transaction
  try {
    const { checkout_url } = await initializePayment({
      tx_ref,
      amount: payable,
      currency,
      customer,
      callback_url,
      return_url,
    });

    return { payment_id: paymentId, tx_ref, checkout_url };
  } catch (err) {
    // Do not leave an orphan pending payment
    try {
      await paymentModel.markFailed(paymentId, {
        failure_reason: "Gateway initialization failed",
        gateway_response: { message: err.message },
      });
    } catch (cleanupErr) {
      console.error(
        `[payment] could not mark payment ${paymentId} failed:`,
        cleanupErr,
      );
    }
    throw err;
  }
};

// ---------- webhook ----------

/**
 * Must be called with the RAW body.
 * Route must be mounted with express.raw() BEFORE express.json().
 */
export const handleWebhook = async (rawBody, headers) => {
  if (!verifyWebhookSignature(rawBody, headers)) {
    throw new ApiError(401, "Invalid webhook signature");
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    throw new ApiError(400, "Invalid webhook payload");
  }

  const tx_ref = event?.tx_ref || event?.data?.tx_ref;
  if (!tx_ref) throw new ApiError(400, "Missing tx_ref in webhook");

  // Never trust the body – always re-verify with the gateway
  const verification = await verifyTransaction(tx_ref);

  return withTransaction((conn) =>
    applyVerification(tx_ref, verification, conn),
  );
};

// ---------- status check ----------

/**
 * Customer / frontend check after returning from the payment page.
 * Pass userId for customers (ownership enforced).
 * Omit userId for admin/internal use.
 */
export const getPaymentStatus = async (tx_ref, { userId = null } = {}) => {
  const payment = await paymentModel.findByTxRef(tx_ref);
  if (!payment) throw new ApiError(404, "Payment not found");

  if (userId != null) {
    const order = await orderModel.findByIdAndUser(payment.order_id, userId);
    // Same error as "not found" so tx_refs cannot be probed
    if (!order) throw new ApiError(404, "Payment not found");
  }

  if (payment.status !== PAYMENT_STATUS.PENDING) return payment;

  // Still pending → re-verify (covers delayed / missed webhooks)
  try {
    const verification = await verifyTransaction(tx_ref);
    if (verification.status === "success" || verification.status === "failed") {
      await withTransaction((conn) =>
        applyVerification(tx_ref, verification, conn),
      );
    }
  } catch (err) {
    // A gateway hiccup must not break a simple status read
    console.error(`[payment] re-verify failed for ${tx_ref}:`, err);
  }

  return paymentModel.findByTxRef(tx_ref);
};

// ---------- admin ----------

export const listPayments = async ({ status, limit, offset } = {}) => {
  if (status && !PAYMENT_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `status must be one of: ${PAYMENT_STATUSES.join(", ")}`,
    );
  }

  const paging = parsePaging({ limit, offset });

  const [items, total] = await Promise.all([
    paymentModel.findAll({ status: status || null, ...paging }),
    paymentModel.countAll({ status: status || null }),
  ]);

  return { items, total, ...paging };
};

// ---------- helpers for order lifecycle (called from order service / jobs) ----------

/**
 * Close any pending payments when an order is cancelled.
 */
export const cancelPendingPaymentsForOrder = async (orderId, conn) => {
  return paymentModel.markCancelledByOrder(orderId, conn);
};

/**
 * Close any pending payments when an order expires unpaid.
 */
export const expirePendingPaymentsForOrder = async (orderId, conn) => {
  return paymentModel.markExpiredByOrder(orderId, conn);
};
