import { Router } from "express";
import { teacherController } from "../controllers/teacher.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN"), teacherController.list);
router.get("/me/assignments", authorize("TEACHER"), teacherController.myAssignments);
router.post("/", authorize("ADMIN"), teacherController.create);
router.put("/:id/assignments", authorize("ADMIN"), validateIdParam, teacherController.updateAssignments);
router.put("/:id/active", authorize("ADMIN"), validateIdParam, teacherController.setActive);

export default router;
