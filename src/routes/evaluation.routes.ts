import { Router } from "express";
import { evaluationController } from "../controllers/evaluation.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/class/:classId", authorize("ADMIN", "SURVEILLANT", "PARENT"), evaluationController.listForClass);
router.post("/devoirs", authorize("ADMIN", "SURVEILLANT"), evaluationController.createDevoir);
router.delete("/devoirs/:id", authorize("ADMIN", "SURVEILLANT"), evaluationController.removeDevoir);

router.get("/compositions", authorize("ADMIN", "SURVEILLANT", "PARENT"), evaluationController.listCompositionDates);
router.post("/compositions", authorize("ADMIN", "SURVEILLANT"), evaluationController.createCompositionDate);
router.delete("/compositions/:id", authorize("ADMIN", "SURVEILLANT"), evaluationController.removeCompositionDate);

export default router;
