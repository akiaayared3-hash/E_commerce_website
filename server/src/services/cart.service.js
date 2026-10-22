import { ApiError } from "../utils/apiError.util.js";
import * as cartModel from "../models/cart.model.js";
import * as variantModel from "../models/variant.model.js";

const MAX_QTY_PER_ITEM = 10;

// ---------- private helpers ----------

const toCents = (price) => Math.round(Number(price) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

const requireUser = (user_id) => {
  if (!user_id) throw new ApiError(401, "Authentication required");
};

// user_id -> cart_id (finds the cart or creates it). cart_id never comes from the client.
const getCartId = async (user_id) => {
  requireUser(user_id);
  return cartModel.create(user_id);
};

const assertQuantity = (quantity, { allowZero = false } = {}) => {
  const min = allowZero ? 0 : 1;
  if (!Number.isInteger(quantity) || quantity < min) {
    throw new ApiError(
      400,
      allowZero
        ? "quantity must be an integer of 0 or more"
        : "quantity must be an integer of at least 1",
    );
  }
  if (quantity > MAX_QTY_PER_ITEM) {
    throw new ApiError(
      400,
      `You can add at most ${MAX_QTY_PER_ITEM} of one item`,
    );
  }
};

const getAvailableVariant = async (variant_id) => {
  const variant = await variantModel.findByIdWithStock(variant_id);
  console.log("Looking for variant_id:", variant_id, typeof variant_id);
  if (!variant) throw new ApiError(404, "Product variant not found");
  console.log("Result from DB:", variant);
  if (!variant.is_active || !variant.product_active) {
    throw new ApiError(409, "This product is no longer available");
  }
  return variant;
};

const assertStock = (wantedQuantity, variant) => {
  if (wantedQuantity > variant.stock) {
    throw new ApiError(
      409,
      variant.stock === 0
        ? "This product is out of stock"
        : `Only ${variant.stock} left in stock`,
    );
  }
};

// One place that decides if a cart row has problems (used by getCart and validateCart)
const getItemProblems = (item) => {
  const problems = [];
  if (!item.product_active) problems.push("Product is no longer available");
  if (!item.variant_active)
    problems.push("This variant is no longer available");
  if (item.quantity < 1) problems.push("Invalid quantity");
  if (item.quantity > item.stock) {
    problems.push(
      item.stock === 0 ? "Out of stock" : `Only ${item.stock} left in stock`,
    );
  }
  return problems;
};

// Builds the full cart response for a known cart_id
const buildCart = async (cart_id) => {
  const rows = await cartModel.listItems(cart_id);

  const items = rows.map((item) => {
    const unitCents = toCents(item.price);
    const problems = getItemProblems(item);
    return {
      ...item,
      price: fromCents(unitCents),
      line_total: fromCents(unitCents * item.quantity),
      _line_cents: unitCents * item.quantity,
      problems, // empty array = valid
      isValid: problems.length === 0,
    };
  });

  // only valid items count toward the subtotal
  const subtotalCents = items
    .filter((i) => i.isValid)
    .reduce((sum, i) => sum + i._line_cents, 0);

  return {
    cart_id,
    items: items.map(({ _line_cents, ...rest }) => rest),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: fromCents(subtotalCents),
    canCheckout: items.length > 0 && items.every((i) => i.isValid),
  };
};

// ---------- public API (every function starts from user_id) ----------

export const getCart = async (user_id) => {
  const cart_id = await getCartId(user_id);
  return buildCart(cart_id);
};

export const addItem = async (user_id, { product_variant_id, quantity }) => {
  if (!product_variant_id) {
    throw new ApiError(400, "product_variant_id is required");
  }
  assertQuantity(quantity);

  const variant = await getAvailableVariant(product_variant_id);
  const cart_id = await getCartId(user_id);

  const existing = await cartModel.findItem(cart_id, product_variant_id);
  const total = (existing?.quantity ?? 0) + quantity;

  if (total > MAX_QTY_PER_ITEM) {
    throw new ApiError(
      409,
      `You can have at most ${MAX_QTY_PER_ITEM} of one item in your cart`,
    );
  }
  assertStock(total, variant);

  // pass only the amount to add; the model increases the existing row
  await cartModel.addItem({ cart_id, product_variant_id, quantity });
  return buildCart(cart_id);
};

export const updateItemQuantity = async (user_id, item_id, quantity) => {
  if (!item_id) throw new ApiError(400, "item_id is required");
  assertQuantity(quantity, { allowZero: true });

  const cart_id = await getCartId(user_id);

  // ownership check: the item must belong to this user's cart
  const item = await cartModel.findItemById(item_id, cart_id);
  if (!item) throw new ApiError(404, "Cart item not found");

  if (quantity === 0) {
    await cartModel.removeItem(item_id, cart_id);
    return buildCart(cart_id);
  }

  const variant = await getAvailableVariant(item.product_variant_id);
  assertStock(quantity, variant);

  await cartModel.setQuantity(item_id, cart_id, quantity);
  return buildCart(cart_id);
};

export const removeItem = async (user_id, item_id) => {
  if (!item_id) throw new ApiError(400, "item_id is required");

  const cart_id = await getCartId(user_id);
  const deleted = await cartModel.removeItem(item_id, cart_id);
  if (!deleted) throw new ApiError(404, "Cart item not found");

  return buildCart(cart_id);
};

export const clearCart = async (user_id) => {
  const cart_id = await getCartId(user_id);
  await cartModel.clear(cart_id);
  return buildCart(cart_id);
};

// Used by the order service right before checkout
export const validateCart = async (user_id) => {
  const cart_id = await getCartId(user_id);
  const cart = await buildCart(cart_id);

  if (cart.items.length === 0) {
    throw new ApiError(400, "Your cart is empty");
  }

  return {
    cart_id,
    isValid: cart.canCheckout,
    items: cart.items,
    subtotal: cart.subtotal,
  };
};
