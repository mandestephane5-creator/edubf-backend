import { Router } from "express";
import { z } from "zod";
import { attendanceController } from "../controllers/attendance.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get(
  "/class/:classId",
  authorize("TEACHER", "ADMIN", "SURVEILLANT"),
  validateParams({ classId: z.string().uuid() }),
  attendanceController.getForClassAndDate
);
router.post("/", authorize("TEACHER", "ADMIN", "SURVEILLANT"), attendanceController.mark);
router.get(
  "/student/:studentId",
  authorize("ADMIN", "SURVEILLANT", "PARENT"),
  validateParams({ studentId: z.string().uuid() }),
  attendanceController.getForStudent
);

export default router;
