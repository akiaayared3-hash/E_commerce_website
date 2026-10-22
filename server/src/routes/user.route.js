import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
// import { protect, restrictTo } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes below require authentication
// router.use(protect);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.patch("/me/password", userController.changePassword);

// Admin routes
// router.use(restrictTo("admin"));
router.get("/", userController.adminList);
router.patch("/:id/status", userController.adminSetStatus);

export default router;
