import { Router } from "express";
import { studentController } from "../controllers/student.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), studentController.list);
router.get("/check-parent-phone", authorize("ADMIN", "SURVEILLANT"), studentController.checkParentPhone);
router.get("/:id", authorize("ADMIN", "SURVEILLANT", "PARENT"), validateIdParam, studentController.getById);
router.get("/:id/grades", authorize("ADMIN", "SURVEILLANT", "PARENT"), validateIdParam, studentController.getGrades);
router.get("/:id/incidents", authorize("ADMIN", "SURVEILLANT", "PARENT"), validateIdParam, studentController.getIncidents);

router.post("/", authorize("ADMIN", "SURVEILLANT"), studentController.create);
router.post("/bulk", authorize("ADMIN", "SURVEILLANT"), studentController.bulkCreate);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, studentController.update);
router.delete("/:id", authorize("ADMIN"), validateIdParam, studentController.remove);

export default router;
