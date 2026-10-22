import { Router } from "express";
import { protect, restrictTo } from "../middlewares/auth.middleware.js";
import * as adminController from "../controllers/admin.controller.js";

const router = Router();

// Everything here requires login + admin role
router.use(protect, restrictTo("admin"));

router.get("/users", adminController.listUsers);
router.patch("/users/:id/status", adminController.setUserStatus);

router.get("/payments", adminController.listPayments);

export default router;
