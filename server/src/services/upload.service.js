import { pool } from "../config/db.js";
import * as uploadModel from "../models/upload.model.js";
import {
  saveProductImage,
  deleteProductImage as deleteImageFile,
  buildProductImageUrl,
} from "../utils/productImageStorage.util.js";
import { ApiError } from "../utils/apiError.util.js";

const formatImages = (images) =>
  images.map((image) => ({
    ...image,
    url: buildProductImageUrl(image.url),
  }));

/**
 * Upload product images and save their database records.
 */
export const uploadProductImages = async (productId, files) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, "Please select at least one image.");
  }

  const savedFiles = [];
  let connection;
  let transactionStarted = false;
  let committed = false;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const existingImages = await uploadModel.listByProduct(
      productId,
      connection,
    );

    const highestSortOrder = existingImages.reduce(
      (highest, image) => Math.max(highest, Number(image.sort_order) || 0),
      -1,
    );

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const saved = await saveProductImage(file);

      savedFiles.push(saved);

      await uploadModel.saveView(
        {
          product_id: productId,
          view_type:
            existingImages.length === 0 && index === 0 ? "front" : "detail",
          url: saved.key,
          color: null,
          alt: file.originalname || null,
          is_primary: existingImages.length === 0 && index === 0,
          sort_order: highestSortOrder + index + 1,
        },
        connection,
      );
    }

    await connection.commit();
    committed = true;
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted && connection) {
      await connection.rollback().catch(() => {});
    }

    if (!committed) {
      await Promise.allSettled(
        savedFiles.map((file) => deleteImageFile(file.key)),
      );
    }

    throw error;
  } finally {
    connection?.release();
  }

  // Fetch after commit, outside the upload cleanup handler.
  return getProductImages(productId);
};

/**
 * Retrieve all images belonging to a product.
 */
export const getProductImages = async (productId) => {
  const images = await uploadModel.listByProduct(productId);
  return formatImages(images);
};

/**
 * Set an image as the primary image.
 */
export const setPrimaryImage = async (productId, imageId) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const updated = await uploadModel.setPrimary(
      imageId,
      productId,
      connection,
    );

    if (!updated) {
      throw new ApiError(404, "Product image not found.");
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }

  return getProductImages(productId);
};

/**
 * Delete an image record and its physical file.
 */
export const deleteProductImage = async (productId, imageId) => {
  const removed = await uploadModel.removeById(imageId, productId);

  if (!removed) {
    throw new ApiError(404, "Product image not found.");
  }

  await deleteImageFile(removed.url);

  return true;
};
