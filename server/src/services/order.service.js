// services/order.service.js
import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";
import * as orderModel from "../models/order.model.js";
import * as addressModel from "../models/address.model.js";
import * as inventoryModel from "../models/inventory.mode.js"; // FIX: was order.model.js
import * as cartModel from "../models/cart.model.js";
import * as userModel from "../models/user.model.js";
import * as paymentService from "./payment.service.js";

// ---------- constants ----------

export const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const ORDER_STATUSES = Object.values(ORDER_STATUS);

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const CUSTOMER_CANCELLABLE = [ORDER_STATUS.PENDING];

// Unpaid orders older than this are cancelled and their stock released
const PENDING_EXPIRY_MINUTES = 30;

// ---------- helpers ----------

const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const assertId = (value, label = "id") => {
  if (!Number.isInteger(Number(value)) || Number(value) < 1) {
    throw new ApiError(400, `A valid ${label} is required`);
  }
};

const parsePaging = ({ page = 1, limit = 10 } = {}) => {
  const p = Math.max(Number(page) || 1, 1);
  const l = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});

// Put the items of an order back into stock (call inside a transaction)
const restockOrder = async (orderId, conn) => {
  const items = await orderModel.listByOrderId(orderId, conn);
  await inventoryModel.restoreStockBulk(
    items.map((i) => ({
      product_variant_id: i.product_variant_id,
      quantity: i.quantity,
    })),
    conn,
  );
};

// Move an order to cancelled + restock, atomically (call inside a transaction)
const cancelAndRestock = async (order, conn) => {
  const moved = await orderModel.transitionStatus(
    order.id,
    order.order_status,
    ORDER_STATUS.CANCELLED,
    conn,
  );
  if (!moved) {
    throw new ApiError(409, "Order status changed, please try again");
  }
  await restockOrder(order.id, conn);
};

// ---------- core: create order from cart ----------

/**
 * Checkout flow
 * 1. Validate address belongs to user
 * 2. Load cart + items
 * 3. Lock stock rows in sorted order (FOR UPDATE)
 * 4. Re-check active status + quantity under lock
 * 5. Freeze prices & calculate total (integer cents, no float drift)
 * 6. Create order + order_items with address snapshot
 * 7. Deduct stock
 * 8. Clear cart
 * 9. Return hydrated order
 */
export const createOrderFromCart = async (userId, shippingAddressId) => {
  assertId(userId, "user id");
  assertId(shippingAddressId, "shipping address id");

  const orderId = await withTransaction(async (conn) => {
    const address = await addressModel.findByIdAndUser(
      shippingAddressId,
      userId,
      conn,
    );
    if (!address) throw new ApiError(404, "Shipping address not found");

    const cart = await cartModel.findByUser(userId, conn);
    if (!cart) throw new ApiError(400, "Your cart is empty");

    const items = await cartModel.listItems(cart.id, conn);
    if (!items.length) throw new ApiError(400, "Your cart is empty");

    // Deterministic lock order prevents deadlocks
    const variantIds = [...new Set(items.map((i) => i.variant_id))].sort(
      (a, b) => a - b,
    );

    const lockedRows = await inventoryModel.lockStockForVariants(
      variantIds,
      conn,
    );
    const stockMap = new Map(
      lockedRows.map((r) => [r.product_variant_id, r.stock_quantity]),
    );

    // Same variant can appear on several cart lines: sum the demand
    const demand = new Map();
    for (const item of items) {
      demand.set(
        item.variant_id,
        (demand.get(item.variant_id) ?? 0) + item.quantity,
      );
    }

    const problems = [];
    const reported = new Set();
    for (const item of items) {
      if (reported.has(item.variant_id)) continue;
      const label = `${item.product_name} (${item.variant_name})`;
      const available = stockMap.get(item.variant_id) ?? 0;
      const wanted = demand.get(item.variant_id);

      if (!item.product_active || !item.variant_active) {
        problems.push(`${label}: no longer available`);
        reported.add(item.variant_id);
      } else if (wanted > available) {
        problems.push(
          available === 0
            ? `${label}: out of stock`
            : `${label}: only ${available} left`,
        );
        reported.add(item.variant_id);
      }
    }

    if (problems.length) {
      throw new ApiError(409, `Cannot place order. ${problems.join("; ")}`);
    }

    // Freeze prices; money math in integer cents
    let totalCents = 0;
    const orderLines = items.map((item) => {
      const unitCents = Math.round(Number(item.price) * 100);
      totalCents += unitCents * item.quantity;
      return {
        product_variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: unitCents / 100,
      };
    });

    if (totalCents <= 0) {
      throw new ApiError(400, "Order total must be greater than zero");
    }
    const totalAmount = totalCents / 100;

    const newOrderId = await orderModel.insert(
      {
        user_id: userId,
        shipping_address_id: shippingAddressId,
        shipping_full_name: address.full_name,
        shipping_phone: address.phone,
        shipping_region: address.region,
        shipping_city: address.city,
        shipping_sub_city: address.sub_city ?? null,
        shipping_woreda: address.woreda ?? null,
        shipping_street: address.street ?? null,
        shipping_landmark: address.landmark ?? null,
        total_amount: totalAmount,
        order_status: ORDER_STATUS.PENDING,
      },
      conn,
    );

    await orderModel.insertItems(
      orderLines.map((line) => ({ order_id: newOrderId, ...line })),
      conn,
    );

    await inventoryModel.deductStockBulk(
      orderLines.map((l) => ({
        product_variant_id: l.product_variant_id,
        quantity: l.quantity,
      })),
      conn,
    );

    await cartModel.clear(cart.id, conn);

    return newOrderId;
  });

  return getMyOrderById(userId, orderId);
};

/**
 * Create order + immediately start payment.
 * If the payment provider call fails, the order is cancelled and stock released,
 * so the customer never ends up with a hidden pending order.
 */
export const createOrderAndStartPayment = async (
  userId,
  shippingAddressId,
  { callback_url, return_url } = {},
) => {
  const order = await createOrderFromCart(userId, shippingAddressId);

  try {
    const user = await userModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const payment = await paymentService.startPayment({
      order_id: order.id,
      amount: order.total_amount,
      currency: "ETB",
      customer: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
      },
      callback_url,
      return_url,
    });

    return {
      order,
      payment: {
        tx_ref: payment.tx_ref,
        checkout_url: payment.checkout_url,
      },
    };
  } catch (err) {
    // Compensate: release stock, then surface the original error
    try {
      await cancelPendingOrderSystem(order.id);
    } catch (cleanupErr) {
      console.error(
        `Failed to cancel order ${order.id} after payment start error:`,
        cleanupErr,
      );
    }
    throw err;
  }
};

// ---------- customer reads & cancel ----------

export const getMyOrderById = async (userId, orderId) => {
  assertId(orderId, "order id");

  const order = await orderModel.findByIdAndUser(orderId, userId);
  if (!order) throw new ApiError(404, "Order not found");

  const items = await orderModel.listByOrderId(orderId);
  return { ...order, items };
};

export const getMyOrders = async (userId, paging = {}) => {
  const { page, limit, offset } = parsePaging(paging);

  const [orders, total] = await Promise.all([
    orderModel.findByUser(userId, { limit, offset }),
    orderModel.countByUser(userId),
  ]);

  return { orders, pagination: buildPagination(page, limit, total) };
};

export const cancelMyOrder = async (userId, orderId) => {
  assertId(orderId, "order id");

  await withTransaction(async (conn) => {
    const order = await orderModel.findByIdAndUser(orderId, userId, conn);
    if (!order) throw new ApiError(404, "Order not found");

    if (!CUSTOMER_CANCELLABLE.includes(order.order_status)) {
      throw new ApiError(
        409,
        `An order that is "${order.order_status}" cannot be cancelled`,
      );
    }

    await cancelAndRestock(order, conn);
  });

  return getMyOrderById(userId, orderId);
};

// ---------- system (no user check) ----------

/**
 * Cancel a still-pending order and release its stock.
 * Safe to call twice: does nothing if the order is no longer pending.
 */
export const cancelPendingOrderSystem = async (orderId) =>
  withTransaction(async (conn) => {
    const order = await orderModel.findById(orderId, conn);
    if (!order || order.order_status !== ORDER_STATUS.PENDING) return false;
    await cancelAndRestock(order, conn);
    return true;
  });

/**
 * Run from a scheduler (setInterval / node-cron) every few minutes.
 * Requires orderModel.findStalePending(minutes) -> [{ id }, ...]
 *   SELECT id FROM orders
 *   WHERE order_status = 'pending'
 *     AND created_at < (NOW() - INTERVAL ? MINUTE)
 *   LIMIT 100
 */
export const expireStalePendingOrders = async (
  minutes = PENDING_EXPIRY_MINUTES,
) => {
  const stale = await orderModel.findStalePending(minutes);
  let cancelled = 0;

  for (const { id } of stale) {
    try {
      if (await cancelPendingOrderSystem(id)) cancelled += 1;
    } catch (err) {
      console.error(`Failed to expire order ${id}:`, err);
    }
  }
  return cancelled;
};

// ---------- admin ----------

export const getAllOrders = async ({ status, page, limit } = {}) => {
  if (status && !ORDER_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }

  const paging = parsePaging({ page, limit });

  const [orders, total] = await Promise.all([
    orderModel.findAll({
      status: status || null,
      limit: paging.limit,
      offset: paging.offset,
    }),
    orderModel.countAll({ status: status || null }),
  ]);

  return {
    orders,
    pagination: buildPagination(paging.page, paging.limit, total),
  };
};

export const getOrderByIdAdmin = async (orderId) => {
  assertId(orderId, "order id");

  const order = await orderModel.findById(orderId);
  if (!order) throw new ApiError(404, "Order not found");

  const items = await orderModel.listByOrderId(orderId);
  return { ...order, items };
};

export const updateOrderStatus = async (orderId, newStatus) => {
  assertId(orderId, "order id");

  if (!ORDER_STATUSES.includes(newStatus)) {
    throw new ApiError(
      400,
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }

  await withTransaction(async (conn) => {
    const order = await orderModel.findById(orderId, conn);
    if (!order) throw new ApiError(404, "Order not found");

    const allowed = ALLOWED_TRANSITIONS[order.order_status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        409,
        `Cannot change order from "${order.order_status}" to "${newStatus}"`,
      );
    }

    if (newStatus === ORDER_STATUS.CANCELLED) {
      // NOTE: cancelling a PAID order restocks but does not refund.
      // Trigger your refund flow here or handle it manually.
      await cancelAndRestock(order, conn);
      return;
    }

    const moved = await orderModel.transitionStatus(
      orderId,
      order.order_status,
      newStatus,
      conn,
    );
    if (!moved) {
      throw new ApiError(409, "Order status changed, please try again");
    }
  });

  return getOrderByIdAdmin(orderId);
};

/**
 * Called by the payment webhook after the provider confirms payment
 * AND the paid amount/currency were verified against order.total_amount.
 * Idempotent.
 *
 * If the order was already cancelled, the money was taken for an order we
 * released. The error carries code "ORDER_CANCELLED" so the webhook can
 * log it and start a refund instead of just failing.
 */
export const markOrderAsPaid = async (orderId, conn = null) => {
  const run = async (connection) => {
    const order = await orderModel.findById(orderId, connection);
    if (!order) throw new ApiError(404, "Order not found");

    if (order.order_status === ORDER_STATUS.PAID) return order; // already paid

    if (order.order_status === ORDER_STATUS.CANCELLED) {
      const err = new ApiError(
        409,
        "Order was cancelled before payment arrived",
      );
      err.code = "ORDER_CANCELLED";
      throw err;
    }

    if (order.order_status !== ORDER_STATUS.PENDING) {
      // processing / shipped / delivered: payment already handled earlier
      return order;
    }

    const moved = await orderModel.transitionStatus(
      orderId,
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAID,
      connection,
    );
    if (!moved) throw new ApiError(409, "Order status changed");

    return orderModel.findById(orderId, connection);
  };

  if (conn) return run(conn);
  return withTransaction(run);
};
