// controllers/product.controller.js
import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  getProduct,
  getProductBySlug,
  getAllProducts,
  createProduct,
  updateProduct,
  setProductStatus,
} from "../services/product.service.js";

const isAdminRequest = (req) => req.user?.role === "admin";

export const getAll = asyncHandler(async (req, res) => {
  const result = await getAllProducts(
    { page: req.query.page, limit: req.query.limit },
    { isAdmin: isAdminRequest(req) },
  );
  res.status(200).json({ success: true, ...result });
});

export const getOne = asyncHandler(async (req, res) => {
  const product = await getProduct(req.params.id, {
    isAdmin: isAdminRequest(req),
  });
  res.status(200).json({ success: true, product });
});

export const getBySlug = asyncHandler(async (req, res) => {
  const product = await getProductBySlug(req.params.slug, {
    isAdmin: isAdminRequest(req),
  });
  res.status(200).json({ success: true, product });
});

export const create = asyncHandler(async (req, res) => {
  const product = await createProduct(req.body, {
    files: req.files ?? [],
  });
  res.status(201).json({ success: true, product });
});

export const update = asyncHandler(async (req, res) => {
  const product = await updateProduct(req.params.id, req.body, {
    files: req.files ?? [],
  });
  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    product,
  });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const productId = req.params.id;

  if (!/^[1-9]\d*$/.test(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  const { is_active } = req.body ?? {};

  if (typeof is_active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: 'The "is_active" field must be a Boolean.',
      example: { is_active: true },
    });
  }

  const product = await setProductStatus(productId, is_active);

  return res.status(200).json({
    success: true,
    message: `Product ${is_active ? "activated" : "deactivated"} successfully.`,
    product,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const productId = req.params.id;

  if (!/^[1-9]\d*$/.test(productId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid product ID.",
    });
  }

  const product = await setProductStatus(productId, false);

  return res.status(200).json({
    success: true,
    message: "Product deactivated successfully.",
    product,
  });
});
