import { Router } from "express";
import { subjectController } from "../controllers/subject.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), subjectController.list);
router.post("/", authorize("ADMIN"), subjectController.create);
router.put("/:id", authorize("ADMIN"), subjectController.update);
router.delete("/:id", authorize("ADMIN"), subjectController.remove);

export default router;
