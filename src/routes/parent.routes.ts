import { Router } from "express";
import { parentController } from "../controllers/parent.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), parentController.list);
router.get("/me/children", authorize("PARENT"), parentController.myChildren);
router.get("/:id", authorize("ADMIN", "SURVEILLANT"), parentController.getById);
router.post("/:id/reset-password", authorize("ADMIN"), parentController.resetPassword);

export default router;
