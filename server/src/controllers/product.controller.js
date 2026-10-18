import { asyncHandler } from "../utils/asyncHandler.util.js";
import {
  getProduct,
  getProductBySlug,
  getAllProducts,
  createProduct,
} from "../services/product.service.js";

// Public routes have no `protect`, so req.user can be missing.
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
  const product = await createProduct(req.body);
  res.status(201).json({ success: true, product });
});
