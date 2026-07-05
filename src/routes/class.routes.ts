import { Router } from "express";
import { classController } from "../controllers/class.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT"), classController.list);
router.get("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, classController.getById);
router.post("/", authorize("ADMIN"), classController.create);
router.put("/:id", authorize("ADMIN"), validateIdParam, classController.update);
router.delete("/:id", authorize("ADMIN"), validateIdParam, classController.remove);

router.post("/:id/subjects", authorize("ADMIN"), validateIdParam, classController.assignSubject);
router.delete(
  "/:id/subjects/:subjectId",
  authorize("ADMIN"),
  validateParams({ id: z.string().uuid(), subjectId: z.string().uuid() }),
  classController.removeSubject
);

export default router;
