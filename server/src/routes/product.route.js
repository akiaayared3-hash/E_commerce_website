import { Router } from "express";
import {
  create,
  getAll,
  getOne,
  getBySlug,
  update,
  updateStatus,
  remove
} from "../controllers/product.controller.js";
import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js";

const router = Router();

router.get("/", getAll);
router.post("/", protect, restrictTo("admin"), create);
router.get("/slug/:slug", getBySlug);
router.get("/:id", getOne);
router.put("/:id", protect, restrictTo("admin"), update);
router.patch("/:id/status", protect, restrictTo("admin"), updateStatus);
router.delete("/:id", protect, restrictTo("admin"), remove);

export default router;
