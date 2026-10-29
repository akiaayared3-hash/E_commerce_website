import { apiRequest } from "./api.js";

const BASE = "/api/cart";

export async function addItem(product_variant_id, quantity = 1) {
  const res = await apiRequest(`${BASE}/items`, {
    method: "POST",
    body: {
      product_variant_id,
      quantity,
    },
  });
  return res.data;
}

export async function updateItem(itemId, quantity) {
  const res = await apiRequest(`${BASE}/items/${itemId}`, {
    method: "PATCH", // or PUT – match your backend
    body: { quantity },
  });
  return res.data;
}

export async function removeItem(itemId) {
  const res = await apiRequest(`${BASE}/items/${itemId}`, {
    method: "DELETE",
  });
  return res.data;
}

export async function clearCart() {
  const res = await apiRequest(`${BASE}`, {
    method: "DELETE",
  });
  return res.data;
}

export async function getCart() {
  const res = await apiRequest(`${BASE}`);
  return res.data;
}