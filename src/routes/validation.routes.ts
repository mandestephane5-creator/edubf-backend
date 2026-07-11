import { Router } from "express";
import { z } from "zod";
import { validationController } from "../controllers/validation.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);
router.use(authorize("SURVEILLANT", "ADMIN"));

router.get("/pending", validationController.listPendingByClass);
router.get("/pending/:classId", validateParams({ classId: z.string().uuid() }), validationController.getPendingDetail);
router.post("/validate", validationController.validateClass);

export default router;
