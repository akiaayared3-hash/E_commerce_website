import { Router } from "express";
import * as deliveryController from "../controllers/delivery.controller.js";
// import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
// router.use(protect);

router.post("/", deliveryController.create);
router.get("/", deliveryController.list);
router.get("/:id", deliveryController.getOne);
router.patch("/:id", deliveryController.update);
router.delete("/:id", deliveryController.remove);
router.patch("/:id/default", deliveryController.setDefault);

export default router;
