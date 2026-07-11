import { Router } from "express";
import { z } from "zod";
import { disruptiveController } from "../controllers/disruptive.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);
router.use(authorize("TEACHER", "ADMIN", "SURVEILLANT"));

router.get("/class/:classId", validateParams({ classId: z.string().uuid() }), disruptiveController.countsForClass);
router.post("/", disruptiveController.report);

export default router;
