// routes/inventory.routes.js
import { Router } from "express";
import {
  protect,
  restrictTo,
} from "../middlewares/authenthicate.middlewares.js"; // spelling kept as in your project
import {
  listInventoryHandler,
  adjustStockHandler,
} from "../controllers/inventory.controller.js";

const router = Router();

// The whole module is admin-only
router.use(protect, restrictTo("admin"));

router.get("/", listInventoryHandler);
router.patch("/:variantId", adjustStockHandler);

export default router;

// In your main app file, next to the other routers:
//   import inventoryRoutes from "./routes/inventory.routes.js";
//   app.use("/api/inventory", inventoryRoutes);
