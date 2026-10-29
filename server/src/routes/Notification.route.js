// routes/notification.routes.js
import express from "express";
import * as controller from "../controllers/Notification.controller.js";

// Use the auth middleware you already built. Adjust the path and names:
//   verifyToken  -> checks the JWT and sets req.user
//   requireAdmin -> allows only admin users
import { protect, restrictTo } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Every notification route is admin-only. Customers can never call these.
router.use(protect, restrictTo);

router.get("/", controller.getNotifications); // GET    /api/notifications?limit=50
router.patch("/read-all", controller.markAllRead); // PATCH  /api/notifications/read-all
router.patch("/:id/read", controller.markRead); // PATCH  /api/notifications/:id/read
router.delete("/", controller.clearAll); // DELETE /api/notifications

export default router;
