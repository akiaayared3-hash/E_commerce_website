import { asyncHandler } from "../utils/asyncHandler.util.js";
import { ApiError } from "../utils/apiError.util.js";
import {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  validateCart,
} from "../services/cart.service.js";

// ---------- helpers ----------

// the logged-in user comes from the auth middleware, never from the client
const getUserId = (req) => req.user?.id;

// returns a positive integer or null
const toId = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ---------- handlers ----------

export const getCartHandler = asyncHandler(async (req, res) => {
  const data = await getCart(getUserId(req));

  res.status(200).json({
    success: true,
    message: "Cart retrieved successfully",
    data,
  });
});

export const addItemHandler = asyncHandler(async (req, res) => {
  const product_variant_id = toId(req.body.product_variant_id);
  const quantity = Number(req.body.quantity ?? 1);

  if (!product_variant_id) {
    throw new ApiError(400, "A valid product_variant_id is required");
  }

  const data = await addItem(getUserId(req), { product_variant_id, quantity });

  res.status(200).json({
    success: true,
    message: "Item added to cart successfully",
    data,
  });
});

export const updateItemHandler = asyncHandler(async (req, res) => {
  const itemId = toId(req.params.itemId);

  if (!itemId) {
    throw new ApiError(400, "A valid itemId is required");
  }
  if (req.body.quantity === undefined) {
    throw new ApiError(400, "quantity is required");
  }

  const data = await updateItemQuantity(
    getUserId(req),
    itemId,
    Number(req.body.quantity),
  );

  res.status(200).json({
    success: true,
    message: "Cart item updated successfully",
    data,
  });
});

export const removeItemHandler = asyncHandler(async (req, res) => {
  const itemId = toId(req.params.itemId);

  if (!itemId) {
    throw new ApiError(400, "A valid itemId is required");
  }

  const data = await removeItem(getUserId(req), itemId);

  res.status(200).json({
    success: true,
    message: "Item removed from cart successfully",
    data,
  });
});

export const clearCartHandler = asyncHandler(async (req, res) => {
  const data = await clearCart(getUserId(req));

  res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    data,
  });
});

export const validateCartHandler = asyncHandler(async (req, res) => {
  const data = await validateCart(getUserId(req));

  res.status(200).json({
    success: true,
    message: data.isValid
      ? "Cart is valid"
      : "Cart has items that need attention",
    data,
  });
});
