// routes/order.routes.js
import { Router } from "express";
import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js"; // spelling kept as in your project
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

// Every order route needs a logged-in user.
// The payment webhook must be mounted OUTSIDE this router (no user token).
router.use(protect);

// Admin routes first, so "admin" is never read as an order id
router.get("/admin/all", restrictTo("admin"), getAllOrdersHandler);
router.get("/admin/:orderId", restrictTo("admin"), getOrderAdminHandler);
router.patch(
  "/admin/:orderId/status",
  restrictTo("admin"),
  updateOrderStatusHandler,
);

// Customer routes
router.post("/", createOrderHandler);
router.get("/", getMyOrdersHandler);
router.get("/:orderId", getMyOrderHandler);
router.patch("/:orderId/cancel", cancelMyOrderHandler);

export default router;
