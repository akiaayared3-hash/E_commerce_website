// controllers/upload.controller.js
import { asyncHandler } from "../utils/asyncHandler.util.js";
import * as uploadService from "../services/upload.service.js";

const toId = (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const badId = (res, label = "ID") =>
  res.status(400).json({
    success: false,
    message: `Invalid ${label}.`,
  });

/**
 * POST /api/products/:productId/images
 * multipart field: images (max 8)
 */
export const uploadProductImages = asyncHandler(async (req, res) => {
  const productId = toId(req.params.productId);
  if (!productId) return badId(res, "product ID");

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({
      success: false,
      message: 'No images uploaded. Use field name "images".',
    });
  }

  const images = await uploadService.uploadProductImages(productId, files);

  res.status(201).json({
    success: true,
    message: `${images.length} image(s) uploaded`,
    images,
  });
});

/**
 * GET /api/products/:productId/images
 */
export const getProductImages = asyncHandler(async (req, res) => {
  const productId = toId(req.params.productId);
  if (!productId) return badId(res, "product ID");

  const images = await uploadService.getProductImages(productId);

  res.status(200).json({
    success: true,
    images,
  });
});

/**
 * PATCH /api/products/:productId/images/:imageId/primary
 */
export const setPrimaryImage = asyncHandler(async (req, res) => {
  const productId = toId(req.params.productId);
  const imageId = toId(req.params.imageId);
  if (!productId) return badId(res, "product ID");
  if (!imageId) return badId(res, "image ID");

  const images = await uploadService.setPrimaryImage(productId, imageId);

  res.status(200).json({
    success: true,
    message: "Primary image updated",
    images,
  });
});

/**
 * DELETE /api/products/:productId/images/:imageId
 */
export const deleteProductImage = asyncHandler(async (req, res) => {
  const productId = toId(req.params.productId);
  const imageId = toId(req.params.imageId);
  if (!productId) return badId(res, "product ID");
  if (!imageId) return badId(res, "image ID");

  await uploadService.deleteProductImage(productId, imageId);

  res.status(200).json({
    success: true,
    message: "Image deleted",
  });
});
