import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", notificationController.list);
router.put("/:id/read", validateIdParam, notificationController.markAsRead);
router.put("/read-all", notificationController.markAllAsRead);

export default router;
