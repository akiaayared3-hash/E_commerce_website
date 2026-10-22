import * as productImageModel from "../models/upload.model.js";
import { deleteFile, getFileUrl } from "../utils/upload.util.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * Upload multiple images for a product
 */
export const uploadProductImages = async (productId, files) => {
  if (!files || files.length === 0) {
    throw new ApiError(400, "At least one image is required");
  }

  const urls = files.map((file) => getFileUrl(file.filename));

  try {
    await productImageModel.insertMany(productId, urls);
  } catch (err) {
    // rollback files if DB fails
    files.forEach((file) => deleteFile(file.filename));
    throw err;
  }

  return productImageModel.listByProduct(productId);
};

/**
 * Get all images of a product
 */
export const getProductImages = async (productId) => {
  return productImageModel.listByProduct(productId);
};

/**
 * Set one image as primary
 */
export const setPrimaryImage = async (productId, imageId) => {
  const image = await productImageModel.findByIdAndProduct(imageId, productId);
  if (!image) throw new ApiError(404, "Image not found");

  await productImageModel.setPrimary(imageId, productId);
  return productImageModel.listByProduct(productId);
};

/**
 * Delete one image
 */
export const deleteProductImage = async (productId, imageId) => {
  const image = await productImageModel.findByIdAndProduct(imageId, productId);
  if (!image) throw new ApiError(404, "Image not found");

  await productImageModel.remove(imageId, productId);
  deleteFile(image.url);

  return true;
};

/**
 * Delete all images of a product (useful when deleting a product)
 */
export const deleteAllProductImages = async (productId) => {
  const urls = await productImageModel.removeAllByProduct(productId);
  urls.forEach((url) => deleteFile(url));
  return true;
};
