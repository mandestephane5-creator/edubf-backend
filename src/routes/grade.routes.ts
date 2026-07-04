import { Router } from "express";
import { gradeController } from "../controllers/grade.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT", "PARENT"), gradeController.list);
router.post("/", authorize("ADMIN", "SURVEILLANT"), gradeController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), gradeController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), gradeController.remove);

router.get(
  "/student/:studentId/average",
  authorize("ADMIN", "SURVEILLANT", "PARENT"),
  gradeController.studentAverage
);
router.get("/class/:classId/ranking", authorize("ADMIN", "SURVEILLANT"), gradeController.classRanking);

export default router;
