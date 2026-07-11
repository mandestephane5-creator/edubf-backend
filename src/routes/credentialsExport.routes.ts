import { Router } from "express";
import { z } from "zod";
import { credentialsExportController } from "../controllers/credentialsExport.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/class/:classId/pdf", validateParams({ classId: z.string().uuid() }), credentialsExportController.exportForClass);

export default router;
