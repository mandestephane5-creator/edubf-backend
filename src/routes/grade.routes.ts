import { Router } from "express";
import { gradeController } from "../controllers/grade.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT", "PARENT"), gradeController.list);
router.post("/", authorize("ADMIN", "SURVEILLANT"), gradeController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, gradeController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, gradeController.remove);

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

export default router;
