// routes/product.routes.js  (image section + existing product routes)
import { Router } from "express";
import multer from "multer";

import {
  create,
  getAll,
  getOne,
  getBySlug,
  update,
  updateStatus,
  remove,
} from "../controllers/product.controller.js";

import {
  uploadProductImages,
  getProductImages,
  setPrimaryImage,
  deleteProductImage,
} from "../controllers/upload.controller.js";

import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js";

const router = Router();

const MAX_IMAGES = 8;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
    files: MAX_IMAGES,
  },
  fileFilter: (req, file, callback) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG, and WebP images are allowed."),
      );
    }
    callback(null, true);
  },
});

// ---------- Public product reads ----------
router.get("/", getAll);
router.get("/slug/:slug", getBySlug);

// ---------- Product images (place BEFORE /:id where needed) ----------
router.get("/:productId/images", getProductImages);

router.post(
  "/:productId/images",
  protect,
  restrictTo("admin"),
  upload.array("images", MAX_IMAGES),
  uploadProductImages,
);

router.patch(
  "/:productId/images/:imageId/primary",
  protect,
  restrictTo("admin"),
  setPrimaryImage,
);

router.delete(
  "/:productId/images/:imageId",
  protect,
  restrictTo("admin"),
  deleteProductImage,
);

// ---------- Public product by id (after image routes) ----------
router.get("/:id", getOne);

// ---------- Admin product writes ----------
router.post(
  "/",
  protect,
  restrictTo("admin"),
  upload.array("images", MAX_IMAGES),
  create,
);

router.put(
  "/:id",
  protect,
  restrictTo("admin"),
  upload.array("images", MAX_IMAGES),
  update,
);

router.patch("/:id/status", protect, restrictTo("admin"), updateStatus);
router.delete("/:id", protect, restrictTo("admin"), remove);

export default router;
