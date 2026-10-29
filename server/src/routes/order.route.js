import { Router } from "express";
import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js";
import { ApiError } from "../utils/apiError.util.js";

import {
  createOrderHandler,
  getMyOrdersHandler,
  getMyOrderHandler,
  cancelMyOrderHandler,
  getAllOrdersHandler,
  getOrderAdminHandler,
  updateOrderStatusHandler,
} from "../controllers/order.controller.js";

const router = Router();

const isValidId = (value) =>
  typeof value === "string" &&
  /^[1-9]\d{0,14}$/.test(value) &&
  Number.isSafeInteger(Number(value));

router.use(protect);

router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.param("orderId", (req, res, next, value) => {
  if (!isValidId(value)) {
    return next(new ApiError(400, "Order id must be a positive whole number"));
  }

  next();
});

// Customer routes
router.post("/", createOrderHandler);
router.get("/", getMyOrdersHandler);

// Admin routes
router.get("/admin/all", restrictTo("admin"), getAllOrdersHandler);
router.get("/admin/:orderId", restrictTo("admin"), getOrderAdminHandler);

router.patch(
  "/admin/:orderId/status",
  restrictTo("admin"),
  updateOrderStatusHandler,
);

// Individual customer orders
router.get("/:orderId", getMyOrderHandler);
router.patch("/:orderId/cancel", cancelMyOrderHandler);

export default router;
