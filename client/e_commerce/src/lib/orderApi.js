import { apiRequest } from "./api.js";

// Supports positive safe integer IDs (1 to 9007199254740991)
const ORDER_ID_PATTERN = /^[1-9]\d{0,15}$/;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Normalizes and validates order IDs.
 * Converts raw numbers or clean strings into valid numeric string IDs.
 */
const normalizeOrderId = (value) => {
  if (value === null || value === undefined) {
    throw new Error("Order ID is required but was not provided.");
  }

  const strValue = String(value).trim();

  if (
    !strValue ||
    !ORDER_ID_PATTERN.test(strValue) ||
    !Number.isSafeInteger(Number(strValue))
  ) {
    throw new Error("Invalid order ID format.");
  }

  return strValue;
};

/**
 * Unwraps nested API response formats smoothly without losing metadata.
 */
const unwrapResponse = (response) => {
  let current = response;

  for (let i = 0; i < 5; i += 1) {
    if (!isRecord(current)) return current;

    if (current.status === "error") {
      throw new Error(
        current.message || "The server could not process the order.",
      );
    }

    if (isRecord(current.order)) return current;

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    return current;
  }

  return current;
};

const pickOrder = (response) => {
  const result = unwrapResponse(response);

  if (!isRecord(result)) return null;
  if (isRecord(result.order)) return result.order;
  if (result.id != null || result.order_id != null) return result;

  return null;
};

const pickPayment = (response) => {
  let current = response;

  for (let i = 0; i < 5; i += 1) {
    if (!isRecord(current)) return null;
    if (isRecord(current.payment)) return current.payment;

    if (isRecord(current.data)) {
      current = current.data;
      continue;
    }

    return null;
  }

  return null;
};

const toOrderBody = (payload = {}) => {
  const { customer, zoneId, zoneLabel, paymentMethod } = payload;

  if (!isRecord(customer)) {
    throw new Error("Customer information is required.");
  }

  const fullName = String(customer.name ?? "").trim();
  const phone = String(customer.phone ?? "").trim();
  const address = String(customer.address ?? "").trim();
  const note = String(customer.note ?? "").trim();
  const deliveryZone = String(zoneLabel || zoneId || "").trim();
  const method = String(paymentMethod || "cod")
    .trim()
    .toLowerCase();

  if (fullName.length < 3) throw new Error("Please enter your full name.");
  if (!phone) throw new Error("Please enter your phone number.");
  if (address.length < 6)
    throw new Error("Please enter a complete delivery address.");
  if (!deliveryZone) throw new Error("Please select a delivery zone.");
  if (!["cod", "chapa"].includes(method))
    throw new Error("Unsupported payment method.");

  return {
    full_name: fullName,
    phone_number: phone,
    address,
    note,
    delivery_zone: deliveryZone,
    city: deliveryZone,
    payment_method: method,
  };
};

export async function createOrder(payload) {
  const body = toOrderBody(payload);

  const response = await apiRequest("/api/orders", {
    method: "POST",
    body,
  });

  const order = pickOrder(response);

  if (!order) {
    throw new Error(
      "The server did not return an order. Please check the API response.",
    );
  }

  const id = normalizeOrderId(order.id ?? order.order_id);
  const payment = pickPayment(response);

  return {
    id,
    raw: order,
    payment,
  };
}

export async function getOrder(id) {
  // Prevent executing network requests on missing or invalid IDs
  if (id === undefined || id === null || id === "" || id === "undefined") {
    throw new Error("Cannot fetch order: No valid order ID provided.");
  }

  const orderId = normalizeOrderId(id);

  const response = await apiRequest(
    `/api/orders/${encodeURIComponent(orderId)}`,
  );

  const order = pickOrder(response);

  if (!order) return null;

  const returnedId = normalizeOrderId(order.id ?? order.order_id);

  if (returnedId !== orderId) {
    throw new Error("The server returned a different order ID.");
  }

  return toViewOrder(order);
}

export const toViewOrder = (order) => {
  if (!isRecord(order)) {
    throw new Error("Invalid order data received from the server.");
  }

  const id = normalizeOrderId(order.id ?? order.order_id);
  const sourceItems = order.items ?? order.order_items ?? [];

  if (!Array.isArray(sourceItems)) {
    throw new Error("Invalid order items received from the server.");
  }

  const items = sourceItems.map((item) => {
    if (!isRecord(item)) {
      throw new Error("An order item has an invalid format.");
    }

    const quantity = Number(item.quantity ?? item.qty);
    const unitPrice = Number(item.unit_price ?? item.price);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      throw new Error("Invalid quantity or price in an order item.");
    }

    const calculatedTotal = Math.round(unitPrice * quantity * 100) / 100;
    const lineTotal =
      item.line_total != null
        ? Number(item.line_total)
        : item.total != null
          ? Number(item.total)
          : calculatedTotal;

    if (!Number.isFinite(lineTotal) || lineTotal < 0) {
      throw new Error("Invalid order item total.");
    }

    return {
      id:
        item.id ??
        item.order_item_id ??
        item.product_variant_id ??
        item.product_id ??
        null,
      productVariantId: item.product_variant_id ?? null,
      name: item.product_name ?? item.name ?? item.variant_name ?? "Product",
      size: item.variant_name ?? item.size ?? "",
      sku: item.sku ?? "",
      qty: quantity,
      unitPrice,
      lineTotal,
    };
  });

  const method = String(
    order.payment_method ?? order.payment?.method ?? "cod",
  ).toLowerCase();

  const addressParts = [
    order.shipping_street,
    order.shipping_woreda,
    order.shipping_sub_city,
    order.shipping_city,
    order.shipping_region,
    order.shipping_landmark,
  ].filter(Boolean);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = Number(order.total_amount ?? order.total);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error("Invalid order total received from the server.");
  }

  const rawDeliveryFee = order.delivery_fee ?? order.shipping_fee ?? null;
  const deliveryFee = rawDeliveryFee == null ? null : Number(rawDeliveryFee);

  if (
    deliveryFee !== null &&
    (!Number.isFinite(deliveryFee) || deliveryFee < 0)
  ) {
    throw new Error("Invalid delivery fee received from the server.");
  }

  return {
    id,
    customer: {
      name:
        order.shipping_full_name ??
        order.customer?.name ??
        order.customer_name ??
        order.full_name ??
        "",
      phone:
        order.shipping_phone ??
        order.customer?.phone ??
        order.phone_number ??
        "",
      address:
        order.customer?.address ?? order.address ?? addressParts.join(", "),
      note: order.shipping_landmark ?? order.note ?? "",
    },
    items,
    subtotal,
    deliveryFee,
    total,
    zoneLabel:
      order.delivery_zone_label ??
      order.zone_label ??
      order.delivery_zone ??
      order.shipping_region ??
      "",
    paymentMethod: method,
    paymentLabel:
      method === "cod" || method === "cash_on_delivery"
        ? "Cash on Delivery"
        : method === "chapa" || method === "online"
          ? "Chapa"
          : method,
    paymentRef:
      order.payment_ref ??
      order.payment?.tx_ref ??
      order.payment?.reference ??
      "",
    status: order.order_status ?? order.status ?? "",
  };
};
