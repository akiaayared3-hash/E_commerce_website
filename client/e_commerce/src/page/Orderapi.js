// src/context/orderApi.js
import { ORDER_ENDPOINT, SHOP, API_BASE } from "./paymentConfig.js";

const KEY = "orders_v1";

const read = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (orders) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders.slice(0, 50)));
  } catch {
    /* storage blocked */
  }
};

// "+251 911-23-45-67", "251911234567", "911234567" -> "0911234567"
export const normalizePhone = (value) => {
  let d = String(value || "").replace(/[^\d+]/g, "");
  d = d.replace(/^\+?251/, "0");
  if (/^[79]\d{8}$/.test(d)) d = "0" + d;
  return d;
};

// Ethiopian mobile: 09xxxxxxxx (Ethio telecom) or 07xxxxxxxx (Safaricom)
export const isEthiopianPhone = (value) =>
  /^0[79]\d{8}$/.test(normalizePhone(value));

const makeId = () => {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${ymd}-${rand}`;
};

// Saves the order and, if ORDER_ENDPOINT is set, sends it to your server too.
// Throws if sending fails, so the customer can retry.
export const createOrder = async (order) => {
  const saved = { ...order, id: makeId(), createdAt: new Date().toISOString() };

  if (ORDER_ENDPOINT) {
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(saved),
    });
    if (!res.ok) throw new Error(`Order endpoint answered ${res.status}`);
  }

  write([saved, ...read()]);
  return saved;
};

export const getOrder = (id) => read().find((o) => o.id === id) || null;

// Update a saved order in this browser (e.g. after Chapa payment is verified)
export const updateOrder = (id, patch) => {
  const orders = read().map((o) => (o.id === id ? { ...o, ...patch } : o));
  write(orders);
  return orders.find((o) => o.id === id) || null;
};

// Asks YOUR server whether Chapa received the payment for this tx_ref.
// Returns true/false. Use it on the order-success page for Chapa orders.
export const verifyChapaPayment = async (txRef) => {
  if (!txRef) return false;
  try {
    const res = await fetch(
      `${API_BASE}/api/chapa/verify/${encodeURIComponent(txRef)}`,
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.paid === true;
  } catch {
    return false;
  }
};

const money = (n) => `ETB ${(n || 0).toLocaleString()}`;

// Plain-text order summary, used for the WhatsApp message
export const buildOrderMessage = (o) =>
  [
    `New order ${o.id} - ${SHOP.name}`,
    "",
    ...o.items.map(
      (i) =>
        `- ${i.qty} x ${i.name}${i.size ? ` (size ${i.size})` : ""}: ${money(i.lineTotal)}`,
    ),
    "",
    `Items: ${money(o.subtotal)}`,
    `Delivery (${o.zoneLabel}): ${o.deliveryFee ? money(o.deliveryFee) : "Free"}`,
    `TOTAL: ${money(o.total)}`,
    "",
    `Payment: ${o.paymentLabel}${o.status === "paid" ? " - PAID" : o.paymentMethod === "cod" ? " - pay on delivery" : ""}`,
    o.paymentRef ? `Reference: ${o.paymentRef}` : "",
    "",
    `Name: ${o.customer.name}`,
    `Phone: ${o.customer.phone}`,
    `Address: ${o.customer.address}`,
    o.customer.note ? `Note: ${o.customer.note}` : "",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
