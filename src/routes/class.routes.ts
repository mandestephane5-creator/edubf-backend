import { Router } from "express";
import { classController } from "../controllers/class.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), classController.list);
router.get("/:id", authorize("ADMIN", "SURVEILLANT"), classController.getById);
router.post("/", authorize("ADMIN"), classController.create);
router.put("/:id", authorize("ADMIN"), classController.update);
router.delete("/:id", authorize("ADMIN"), classController.remove);

router.post("/:id/subjects", authorize("ADMIN"), classController.assignSubject);
router.delete("/:id/subjects/:subjectId", authorize("ADMIN"), classController.removeSubject);

export default router;
