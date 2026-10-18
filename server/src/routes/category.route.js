import { Router } from 'express'
import{
    create,
    list,
    getOne,
    update,
    remove
} from '../controllers/category.controller.js'

import { protect, restrictTo } from '../middlewares/authenthicate.middlewares.js';

const router = Router();

router.post("/", protect, restrictTo("admin"), create);
router.get("/", list) 
router.get("/:id", getOne)
router.patch("/:id", protect, restrictTo("admin"), update)
router.delete("/:id", protect, restrictTo("admin"), remove)


export default router;