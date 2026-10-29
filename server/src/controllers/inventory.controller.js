// controllers/inventory.controller.js
import * as inventoryService from "../services/inventory.service.js";
import { ApiError } from "../utils/apiError.util.js";

export const listInventoryHandler = async (req, res, next) => {
  try {
    const { rows, pagination } = await inventoryService.listInventory(
      req.query,
    );
    res.status(200).json({ success: true, data: rows, pagination });
  } catch (err) {
    next(err);
  }
};

export const adjustStockHandler = async (req, res, next) => {
  try {
    const variantId = Number(req.params.variantId);
    if (!Number.isInteger(variantId) || variantId < 1) {
      throw new ApiError(400, "Invalid variant id");
    }
    const updated = await inventoryService.adjustStock(
      variantId,
      req.body?.delta,
    );
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
