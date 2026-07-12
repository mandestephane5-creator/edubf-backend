import { Router } from "express";
import { gradeController } from "../controllers/grade.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT", "PARENT", "TEACHER"), gradeController.list);
router.post("/", authorize("ADMIN", "SURVEILLANT", "TEACHER"), gradeController.create);
router.post("/batch", authorize("ADMIN", "SURVEILLANT", "TEACHER"), gradeController.createBatch);
router.put("/:id", authorize("ADMIN", "SURVEILLANT", "TEACHER"), validateIdParam, gradeController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, gradeController.remove);
router.get("/:id/audit-log", authorize("ADMIN", "SURVEILLANT", "TEACHER"), validateIdParam, gradeController.auditLogForGrade);

router.get(
  "/student/:studentId/average",
  authorize("ADMIN", "SURVEILLANT", "PARENT"),
  validateParams({ studentId: z.string().uuid() }),
  gradeController.studentAverage
);
router.get(
  "/class/:classId/ranking",
  authorize("ADMIN", "SURVEILLANT"),
  validateParams({ classId: z.string().uuid() }),
  gradeController.classRanking
);
router.get(
  "/class/:classId/average",
  authorize("ADMIN", "SURVEILLANT", "PARENT"),
  validateParams({ classId: z.string().uuid() }),
  gradeController.classAverageOnly
);

router.get("/audit-log", authorize("ADMIN", "SURVEILLANT"), gradeController.auditLog);
router.get("/stats/teacher", authorize("TEACHER", "ADMIN", "SURVEILLANT"), gradeController.teacherStats);
router.get("/stats/school", authorize("ADMIN", "SURVEILLANT"), gradeController.schoolStats);
router.get(
  "/stats/repeaters/:classId",
  authorize("ADMIN", "SURVEILLANT"),
  validateParams({ classId: z.string().uuid() }),
  gradeController.repeaters
);

export default router;
