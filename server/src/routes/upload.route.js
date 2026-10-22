import { Router } from "express";
import { upload } from "../utils/upload.util.js";
import * as uploadController from "../controllers/upload.controller.js";
// import { protect, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

// router.use(protect, restrictTo("admin"));

router.post(
  "/products/:productId",
  upload.array("images", 10),
  uploadController.uploadProductImages,
);

router.get("/products/:productId", uploadController.getProductImages);

router.patch(
  "/products/:productId/images/:imageId/primary",
  uploadController.setPrimaryImage,
);

router.delete(
  "/products/:productId/images/:imageId",
  uploadController.deleteProductImage,
);

export default router;
