import { Router } from "express";
import { subjectController } from "../controllers/subject.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), subjectController.list);
router.post("/", authorize("ADMIN"), subjectController.create);
router.put("/:id", authorize("ADMIN"), validateIdParam, subjectController.update);
router.delete("/:id", authorize("ADMIN"), validateIdParam, subjectController.remove);

export default router;
