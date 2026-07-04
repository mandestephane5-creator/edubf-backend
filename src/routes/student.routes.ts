import { Router } from "express";
import { studentController } from "../controllers/student.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), studentController.list);
router.get("/check-parent-phone", authorize("ADMIN", "SURVEILLANT"), studentController.checkParentPhone);
router.get("/:id", authorize("ADMIN", "SURVEILLANT", "PARENT"), studentController.getById);
router.get("/:id/grades", authorize("ADMIN", "SURVEILLANT", "PARENT"), studentController.getGrades);
router.get("/:id/incidents", authorize("ADMIN", "SURVEILLANT", "PARENT"), studentController.getIncidents);

router.post("/", authorize("ADMIN", "SURVEILLANT"), studentController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), studentController.update);
router.delete("/:id", authorize("ADMIN"), studentController.remove);

export default router;
