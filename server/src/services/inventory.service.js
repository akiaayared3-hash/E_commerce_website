// services/inventory.service.js
import * as Inventory from "../models/inventory.mode.js";
import { ApiError } from "../utils/apiError.util.js";

export const listInventory = async ({
  page = 1,
  limit = 10,
  search = "",
} = {}) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const s = String(search ?? "").trim();

  const [rows, total] = await Promise.all([
    Inventory.listWithProducts({ limit: l, offset: (p - 1) * l, search: s }),
    Inventory.countWithProducts(s),
  ]);

  return {
    rows,
    pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) },
  };
};

// delta: whole number, positive to add stock, negative to remove
export const adjustStock = async (variantId, delta) => {
  const d = Number(delta);
  if (!Number.isInteger(d) || d === 0) {
    throw new ApiError(400, "delta must be a non-zero whole number");
  }

  const current = await Inventory.findByVariantId(variantId);
  if (!current) throw new ApiError(404, "Inventory record not found");

  const ok = await Inventory.adjustStock(variantId, d);
  if (!ok) throw new ApiError(409, "Stock cannot go below zero");

  return Inventory.findByVariantId(variantId); // the real new quantity
};
