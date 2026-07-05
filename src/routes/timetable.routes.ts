import { Router } from "express";
import { timetableController } from "../controllers/timetable.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.get(
  "/class/:classId",
  authorize("ADMIN", "SURVEILLANT", "PARENT"),
  validateParams({ classId: z.string().uuid() }),
  timetableController.getForClass
);
router.post("/", authorize("ADMIN", "SURVEILLANT"), timetableController.createSlot);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, timetableController.removeSlot);

export default router;
