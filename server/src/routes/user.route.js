import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js";

const router = Router();

// All routes require authentication.
router.use(protect);

// Authenticated user's profile.
router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/password", userController.changePassword);

// Admin-only routes.
router.use(restrictTo("admin"));

router.get("/", userController.adminList);
router.patch("/:id/status", userController.adminSetStatus);

export default router;
