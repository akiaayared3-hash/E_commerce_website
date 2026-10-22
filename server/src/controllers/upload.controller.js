import * as uploadService from "../services/upload.service.js";

export const uploadProductImages = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const images = await uploadService.uploadProductImages(
      productId,
      req.files,
    );

    res.status(201).json({
      success: true,
      message: `${images.length} image(s) uploaded`,
      data: images,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductImages = async (req, res, next) => {
  try {
    const images = await uploadService.getProductImages(req.params.productId);
    res.json({ success: true, data: images });
  } catch (err) {
    next(err);
  }
};

export const setPrimaryImage = async (req, res, next) => {
  try {
    const images = await uploadService.setPrimaryImage(
      req.params.productId,
      req.params.imageId,
    );
    res.json({ success: true, data: images });
  } catch (err) {
    next(err);
  }
};

export const deleteProductImage = async (req, res, next) => {
  try {
    await uploadService.deleteProductImage(
      req.params.productId,
      req.params.imageId,
    );
    res.json({ success: true, message: "Image deleted" });
  } catch (err) {
    next(err);
  }
};
