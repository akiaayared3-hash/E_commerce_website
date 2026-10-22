import { Router } from "express";
import { protect } from "../middlewares/authenthicate.middlewares.js";
import {
  getCartHandler,
  addItemHandler,
  updateItemHandler,
  removeItemHandler,
  clearCartHandler,
  validateCartHandler,
} from "../controllers/cart.controller.js";

const router = Router();

// every cart route needs a logged-in user (any role)
router.use(protect);

router.get("/", getCartHandler);
router.get("/validate", validateCartHandler);
router.post("/items", addItemHandler);
router.patch("/items/:itemId", updateItemHandler);
router.delete("/items/:itemId", removeItemHandler);
router.delete("/", clearCartHandler);

export default router;
