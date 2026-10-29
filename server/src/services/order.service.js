import { pool } from "../config/db.js";
import { ApiError } from "../utils/apiError.util.js";
import * as orderModel from "../models/order.model.js";
import * as addressModel from "../models/address.model.js";
import * as inventoryModel from "../models/inventory.mode.js";
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

export const PAYMENT_METHOD = {
  COD: "cod",
  CHAPA: "chapa",
};

const PAYMENT_METHOD_ALIASES = {
  cod: PAYMENT_METHOD.COD,
  cash: PAYMENT_METHOD.COD,
  cash_on_delivery: PAYMENT_METHOD.COD,
  chapa: PAYMENT_METHOD.CHAPA,
  online: PAYMENT_METHOD.CHAPA,
};

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const CUSTOMER_CANCELLABLE = [ORDER_STATUS.PENDING];
const PENDING_EXPIRY_MINUTES = 30;
const MYSQL_DEADLOCK = 1213;
const MAX_DEADLOCK_RETRIES = 2;

const PAYMENT_UNAVAILABLE_MESSAGE =
  "Online payment is not available right now. Please choose Cash on Delivery or try again later.";
const PAYMENT_START_FAILED_MESSAGE =
  "We could not start the payment. Please try again or choose Cash on Delivery.";

// ---------- transaction helper ----------

const withTransaction = async (fn) => {
  for (let attempt = 0; ; attempt += 1) {
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const result = await fn(conn);

      await conn.commit();
      return result;
    } catch (err) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error("[order] transaction rollback failed:", rollbackErr);
      }

      if (err?.errno === MYSQL_DEADLOCK && attempt < MAX_DEADLOCK_RETRIES) {
        continue;
      }

      throw err;
    } finally {
      conn.release();
    }
  }
};

// ---------- validation helpers ----------

const parseId = (value, label = "id") => {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    (typeof value === "string" && !/^[1-9]\d{0,14}$/.test(value)) ||
    (typeof value === "number" && (!Number.isSafeInteger(value) || value <= 0))
  ) {
    throw new ApiError(400, `${label} must be a positive whole number`);
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, `${label} must be a positive whole number`);
  }

  return id;
};

const parsePaymentMethod = (value) => {
  const key = String(value ?? PAYMENT_METHOD.COD)
    .trim()
    .toLowerCase();

  const method = PAYMENT_METHOD_ALIASES[key];

  if (!method) {
    throw new ApiError(400, "payment_method must be one of: cod, chapa");
  }

  return method;
};

const parsePaging = ({ page = 1, limit = 10 } = {}) => {
  const parseInteger = (value, fallback) => {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }

    const text = String(value);

    if (!/^[1-9]\d*$/.test(text)) {
      return fallback;
    }

    const number = Number(text);

    return Number.isSafeInteger(number) ? number : fallback;
  };

  const currentPage = Math.min(parseInteger(page, 1), 1_000_000);
  const currentLimit = Math.min(parseInteger(limit, 10), 50);

  return {
    page: currentPage,
    limit: currentLimit,
    offset: (currentPage - 1) * currentLimit,
  };
};

const buildPagination = (page, limit, total) => {
  const count = Number(total);

  return {
    page,
    limit,
    total: Number.isFinite(count) ? count : 0,
    totalPages: limit > 0 && count > 0 ? Math.ceil(count / limit) : 0,
  };
};

// ---------- response formatting ----------

const toNumber = (value) => (value == null ? value : Number(value));

const formatItem = (item) => {
  const unit = Number(item.unit_price);
  const quantity = Number(item.quantity);

  return {
    ...item,
    unit_price: unit,
    line_total: (Math.round(unit * 100) * quantity) / 100,
  };
};

const formatOrder = (order) => {
  if (!order) return order;

  return {
    ...order,
    status: order.order_status,
    customer_name: order.shipping_full_name || "—",
    total_amount: toNumber(order.total_amount),
    ...(Array.isArray(order.items)
      ? { items: order.items.map(formatItem) }
      : {}),
  };
};

// ---------- address validation ----------

const ETHIOPIAN_MOBILE = /^(?:\+?251|0)?([79]\d{8})$/;

const normalizePhone = (value) => {
  const digits = String(value ?? "").replace(/[\s\-().]/g, "");
  const match = ETHIOPIAN_MOBILE.exec(digits);

  if (!match) {
    throw new ApiError(
      400,
      "Enter a valid Ethiopian mobile number, for example 0911223344",
    );
  }

  return `+251${match[1]}`;
};

const optionalText = (value, max, label) => {
  const text = String(value ?? "").trim();

  if (!text) return null;

  if (text.length > max) {
    throw new ApiError(400, `${label} must be at most ${max} characters`);
  }

  return text;
};

const normalizeAddress = (input = {}) => {
  const fullName = String(input.full_name ?? "").trim();

  if (fullName.length < 2 || fullName.length > 120) {
    throw new ApiError(400, "Full name must be 2 to 120 characters");
  }

  const street = String(input.street ?? input.address ?? "").trim();

  if (street.length < 3 || street.length > 150) {
    throw new ApiError(400, "Address must be 3 to 150 characters");
  }

  const region = optionalText(
    input.region ?? input.delivery_zone,
    80,
    "Region",
  );

  if (!region) {
    throw new ApiError(400, "Region is required");
  }

  return {
    full_name: fullName,
    phone: normalizePhone(input.phone ?? input.phone_number),
    region,
    city: optionalText(input.city, 80, "City") ?? region,
    sub_city: optionalText(input.sub_city, 80, "Sub-city"),
    woreda: optionalText(input.woreda, 80, "Woreda"),
    street,
    landmark: optionalText(input.landmark ?? input.note, 255, "Note"),
  };
};

// ---------- stock helpers ----------

const restockOrder = async (orderId, conn) => {
  const items = await orderModel.listByOrderId(orderId, conn);

  await inventoryModel.restoreStockBulk(
    items.map((item) => ({
      product_variant_id: item.product_variant_id,
      quantity: item.quantity,
    })),
    conn,
  );
};

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

const assertCanFulfil = (items, stockMap) => {
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
};

const priceLines = (items) => {
  let totalCents = 0;

  const lines = items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ApiError(400, "Your cart contains an invalid quantity");
    }

    const unitCents = Math.round(Number(item.price) * 100);

    if (!Number.isFinite(unitCents) || unitCents < 0) {
      throw new ApiError(409, `${item.product_name}: price is unavailable`);
    }

    totalCents += unitCents * item.quantity;

    return {
      product_variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: unitCents / 100,
    };
  });

  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new ApiError(400, "Order total must be greater than zero");
  }

  return {
    lines,
    totalAmount: totalCents / 100,
  };
};

// ---------- create order transaction ----------

const createOrderTx = (userId, paymentMethod, resolveAddress) =>
  withTransaction(async (conn) => {
    const lockedCart = await orderModel.lockCartForUser(userId, conn);

    if (!lockedCart) {
      throw new ApiError(400, "Your cart is empty");
    }

    const { id: addressId, address } = await resolveAddress(conn);

    const cart = await cartModel.findByUser(userId, conn);

    if (!cart) {
      throw new ApiError(400, "Your cart is empty");
    }

    const items = await cartModel.listItems(cart.id, conn);

    if (!items.length) {
      throw new ApiError(400, "Your cart is empty");
    }

    // Lock stock rows in a stable order to avoid deadlocks
    const variantIds = [...new Set(items.map((item) => item.variant_id))].sort(
      (a, b) => a - b,
    );

    const lockedRows = await inventoryModel.lockStockForVariants(
      variantIds,
      conn,
    );

    const stockMap = new Map(
      lockedRows.map((row) => [row.product_variant_id, row.stock_quantity]),
    );

    assertCanFulfil(items, stockMap);

    const { lines, totalAmount } = priceLines(items);

    const newOrderId = await orderModel.insert(
      {
        user_id: userId,
        shipping_address_id: addressId,
        shipping_full_name: address.full_name,
        shipping_phone: address.phone,
        shipping_region: address.region,
        shipping_city: address.city,
        shipping_sub_city: address.sub_city ?? null,
        shipping_woreda: address.woreda ?? null,
        shipping_street: address.street ?? null,
        shipping_landmark: address.landmark ?? null,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        order_status: ORDER_STATUS.PENDING,
      },
      conn,
    );

    await orderModel.insertItems(
      lines.map((line) => ({
        order_id: newOrderId,
        ...line,
      })),
      conn,
    );

    await inventoryModel.deductStockBulk(
      lines.map((line) => ({
        product_variant_id: line.product_variant_id,
        quantity: line.quantity,
      })),
      conn,
    );

    await cartModel.clear(cart.id, conn);

    return newOrderId;
  });

const useSavedAddress = (userId, addressId) => async (conn) => {
  const address = await addressModel.findByIdForUpdateAndUser(addressId, userId, conn);

  if (!address) {
    throw new ApiError(404, "Shipping address not found");
  }

  return { id: addressId, address };
};

const useNewAddress = (userId, details) => async (conn) => {
  const id = await addressModel.insert({ user_id: userId, ...details }, conn);

  const address = await addressModel.findByIdForUpdateAndUser(id, userId, conn);

  if (!address) {
    throw new ApiError(404, "Shipping address not found");
  }

  return { id, address };
};

// ---------- checkout ----------

export const createOrderFromCart = async (
  userId,
  shippingAddressId,
  { paymentMethod = PAYMENT_METHOD.COD } = {},
) => {
  const uid = parseId(userId, "user id");
  const addressId = parseId(shippingAddressId, "shipping address id");
  const method = parsePaymentMethod(paymentMethod);

  const orderId = await createOrderTx(
    uid,
    method,
    useSavedAddress(uid, addressId),
  );

  return getMyOrderById(uid, orderId);
};

export const createOrderFromCartWithDetails = async (
  userId,
  addressData = {},
  { paymentMethod = PAYMENT_METHOD.COD } = {},
) => {
  const uid = parseId(userId, "user id");
  const method = parsePaymentMethod(paymentMethod);
  const details = normalizeAddress(addressData);

  const orderId = await createOrderTx(uid, method, useNewAddress(uid, details));

  return getMyOrderById(uid, orderId);
};

// ---------- payment ----------

const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isLocalUrl = (value) => {
  try {
    const { hostname } = new URL(String(value));
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
};

/**
 * Fails fast, BEFORE any order is created or stock is touched, when online
 * payment cannot work. Logs exactly what is missing for the developer and
 * returns a clean message for the customer.
 */
const assertOnlinePaymentReady = ({ callback_url, return_url }) => {
  const missing = [];

  if (!isHttpUrl(callback_url)) missing.push("PAYMENT_CALLBACK_URL");
  if (!isHttpUrl(return_url)) missing.push("PAYMENT_RETURN_URL");
  if (!process.env.CHAPA_SECRET_KEY) missing.push("CHAPA_SECRET_KEY");

  if (missing.length) {
    console.error(
      `[order] online payment unavailable, missing or invalid: ${missing.join(", ")}`,
    );
    throw new ApiError(503, PAYMENT_UNAVAILABLE_MESSAGE);
  }

  if (isLocalUrl(callback_url)) {
    console.warn(
      "[order] PAYMENT_CALLBACK_URL points to localhost; Chapa cannot reach it. Use a public URL (for example a tunnel) in development.",
    );
  }
};

// Chapa expects a local-style mobile number; send nothing rather than
// something it may reject.
const toChapaPhone = (value) => {
  const digits = String(value ?? "").replace(/[\s\-().]/g, "");
  const match = ETHIOPIAN_MOBILE.exec(digits);
  return match ? `0${match[1]}` : undefined;
};

const initiatePayment = async (userId, order, { callback_url, return_url }) => {
  const user = await userModel.findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.email) {
    throw new ApiError(400, "An email address is required for online payment");
  }

  const phone = toChapaPhone(user.phone_number);

  const customer = {
    email: user.email,
    first_name: user.first_name || "Customer",
    last_name: user.last_name || "Customer",
    ...(phone ? { phone_number: phone } : {}),
  };

  try {
    return await paymentService.startPayment({
      order_id: order.id,
      amount: order.total_amount,
      currency: "ETB",
      customer,
      callback_url,
      return_url,
    });
  } catch (err) {
    // Our own, customer-safe errors pass through unchanged
    if (err instanceof ApiError) throw err;

    // Anything else (gateway or network detail) stays in the server log
    console.error("[order] payment initialization failed:", {
      message: err?.message,
      statusCode: err?.statusCode,
      code: err?.code,
      gatewayStatus: err?.response?.status,
      gatewayResponse: err?.response?.data,
    });
    throw new ApiError(
      502,
      "We could not start the Chapa payment. Please try again or choose Cash on Delivery.",
    );
  }
};

export const placeOrder = async (
  userId,
  {
    shippingAddressId = null,
    address = null,
    paymentMethod,
    callback_url,
    return_url,
  } = {},
) => {
  const method = parsePaymentMethod(paymentMethod);
  const online = method !== PAYMENT_METHOD.COD;

  if (online) {
    assertOnlinePaymentReady({ callback_url, return_url });
  }

  const order = shippingAddressId
    ? await createOrderFromCart(userId, shippingAddressId, {
        paymentMethod: method,
      })
    : await createOrderFromCartWithDetails(userId, address ?? {}, {
        paymentMethod: method,
      });

  if (!online) {
    return { order, payment: null };
  }

  try {
    const payment = await initiatePayment(userId, order, {
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
    // Payment never started: release the stock and cancel the order
    try {
      await cancelPendingOrderSystem(order.id);
    } catch (cleanupErr) {
      console.error(
        `[order] failed to cancel order ${order.id} after payment start error:`,
        cleanupErr,
      );
    }

    throw err;
  }
};

export const createOrderAndStartPayment = (
  userId,
  shippingAddressId,
  { callback_url, return_url } = {},
) =>
  placeOrder(userId, {
    shippingAddressId,
    paymentMethod: PAYMENT_METHOD.CHAPA,
    callback_url,
    return_url,
  });

export const startPaymentForOrder = async (
  userId,
  orderId,
  { callback_url, return_url } = {},
) => {
  const order = await getMyOrderById(userId, orderId);

  if (order.order_status !== ORDER_STATUS.PENDING) {
    throw new ApiError(409, "Order is not pending payment");
  }

  if (order.payment_method === PAYMENT_METHOD.COD) {
    throw new ApiError(409, "This order is paid on delivery");
  }

  assertOnlinePaymentReady({ callback_url, return_url });

  return initiatePayment(userId, order, {
    callback_url,
    return_url,
  });
};

// ---------- customer reads and cancellation ----------

export const getMyOrderById = async (userId, orderId) => {
  const uid = parseId(userId, "user id");
  const id = parseId(orderId, "order id");

  const order = await orderModel.findByIdForUpdateAndUser(id, uid);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const items = await orderModel.listByOrderId(order.id);

  return formatOrder({ ...order, items });
};

export const getMyOrders = async (userId, paging = {}) => {
  const uid = parseId(userId, "user id");
  const { page, limit, offset } = parsePaging(paging);

  const [orders, total] = await Promise.all([
    orderModel.findByUser(uid, { limit, offset }),
    orderModel.countByUser(uid),
  ]);

  return {
    orders: orders.map(formatOrder),
    pagination: buildPagination(page, limit, total),
  };
};

export const cancelMyOrder = async (userId, orderId) => {
  const uid = parseId(userId, "user id");
  const id = parseId(orderId, "order id");

  await withTransaction(async (conn) => {
    const order = await orderModel.findByIdForUpdateAndUser(id, uid, conn);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (!CUSTOMER_CANCELLABLE.includes(order.order_status)) {
      throw new ApiError(
        409,
        `An order that is "${order.order_status}" cannot be cancelled`,
      );
    }

    await cancelAndRestock(order, conn);
  });

  return getMyOrderById(uid, id);
};

// ---------- system operations ----------

/**
 * Cancels a pending order and restores its stock.
 * With onlineOnly, Cash on Delivery orders are left alone: they stay pending
 * until an admin processes them, so they must not be auto-expired.
 */
export const cancelPendingOrderSystem = async (
  orderId,
  { onlineOnly = false } = {},
) => {
  const id = parseId(orderId, "order id");

  return withTransaction(async (conn) => {
    const order = await orderModel.findByIdForUpdate(id, conn);

    if (!order || order.order_status !== ORDER_STATUS.PENDING) {
      return false;
    }

    if (onlineOnly && order.payment_method === PAYMENT_METHOD.COD) {
      return false;
    }

    await cancelAndRestock(order, conn);
    return true;
  });
};

export const expireStalePendingOrders = async (
  minutes = PENDING_EXPIRY_MINUTES,
) => {
  const stale = await orderModel.findStalePending(minutes);
  let cancelled = 0;

  for (const { id } of stale) {
    try {
      if (await cancelPendingOrderSystem(id, { onlineOnly: true })) {
        cancelled += 1;
      }
    } catch (err) {
      console.error(`[order] failed to expire order ${id}:`, err);
    }
  }

  return cancelled;
};

// ---------- admin ----------

export const getAllOrders = async ({ status, page, limit } = {}) => {
  const wanted = status ? String(status).trim().toLowerCase() : null;

  if (wanted && !ORDER_STATUSES.includes(wanted)) {
    throw new ApiError(
      400,
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }

  const paging = parsePaging({ page, limit });

  const [orders, total] = await Promise.all([
    orderModel.findAll({
      status: wanted,
      limit: paging.limit,
      offset: paging.offset,
    }),
    orderModel.countAll({ status: wanted }),
  ]);

  return {
    orders: orders.map(formatOrder),
    pagination: buildPagination(paging.page, paging.limit, total),
  };
};

export const getOrderByIdAdmin = async (orderId) => {
  const id = parseId(orderId, "order id");

  const order = await orderModel.findByIdForUpdate(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const items = await orderModel.listByOrderId(id);

  return formatOrder({ ...order, items });
};

const nextStatuses = (order) =>
  order.order_status === ORDER_STATUS.PENDING &&
  order.payment_method === PAYMENT_METHOD.COD
    ? [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED]
    : (ALLOWED_TRANSITIONS[order.order_status] ?? []);

export const updateOrderStatus = async (orderId, newStatus) => {
  const id = parseId(orderId, "order id");
  const status = String(newStatus ?? "")
    .trim()
    .toLowerCase();

  if (!ORDER_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    );
  }

  await withTransaction(async (conn) => {
    const order = await orderModel.findByIdForUpdate(id, conn);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (!nextStatuses(order).includes(status)) {
      throw new ApiError(
        409,
        `Cannot change order from "${order.order_status}" to "${status}"`,
      );
    }

    if (status === ORDER_STATUS.CANCELLED) {
      await cancelAndRestock(order, conn);
      return;
    }

    const moved = await orderModel.transitionStatus(
      id,
      order.order_status,
      status,
      conn,
    );

    if (!moved) {
      throw new ApiError(409, "Order status changed, please try again");
    }
  });

  return getOrderByIdAdmin(id);
};

// ---------- payment webhook ----------

export const markOrderAsPaid = async (orderId, conn = null) => {
  const id = parseId(orderId, "order id");

  const run = async (connection) => {
    const order = await orderModel.findByIdForUpdate(id, connection);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (order.order_status === ORDER_STATUS.PAID) {
      return order;
    }

    if (order.order_status === ORDER_STATUS.CANCELLED) {
      const err = new ApiError(
        409,
        "Order was cancelled before payment arrived",
      );

      err.code = "ORDER_CANCELLED";
      throw err;
    }

    if (order.order_status !== ORDER_STATUS.PENDING) {
      return order;
    }

    const moved = await orderModel.transitionStatus(
      id,
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PAID,
      connection,
    );

    if (!moved) {
      throw new ApiError(409, "Order status changed");
    }

    return orderModel.findByIdForUpdate(id, connection);
  };

  if (conn) {
    return run(conn);
  }

  return withTransaction(run);
};
