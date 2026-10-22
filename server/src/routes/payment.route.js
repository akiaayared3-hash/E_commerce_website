import { Router } from "express";
import express from "express";
import * as paymentController from "../controllers/payment.controller.js";
// import { protect, restrictTo } from "../middlewares/auth.middleware.js"; // if you have auth

const router = Router();

// ---------- Public / Frontend ----------

// Initialize payment (usually called by Order service, but exposed if needed)
router.post("/initialize", paymentController.initialize);

// Check status after user returns from gateway
router.get("/status/:tx_ref", paymentController.getStatus);

// ---------- Webhook (MUST use raw body) ----------
router.post(
  "/webhooks/chapa",
  express.raw({ type: "application/json" }), // critical
  paymentController.chapaWebhook,
);

// ---------- Admin ----------
// router.get("/admin", protect, restrictTo("admin"), paymentController.adminList);
router.get("/admin", paymentController.adminList); // remove auth for now if testing

export default router;
