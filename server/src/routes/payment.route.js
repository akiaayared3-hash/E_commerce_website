// routes/payment.routes.js
import express from "express";
import { Router } from "express";
import * as paymentController from "../controllers/payment.controller.js";
import { protect, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();



router.post(
  "/initialize",
  protect, // require logged-in user
  paymentController.initialize,
);

router.get("/status/:tx_ref", protect, paymentController.getStatus);


router.get("/admin", protect, restrictTo("admin"), paymentController.adminList);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.chapaWebhook,
);

export default router;
