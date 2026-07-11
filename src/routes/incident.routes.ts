import { Router } from "express";
import { z } from "zod";
import { incidentController } from "../controllers/incident.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT", "PARENT", "TEACHER"), incidentController.list);
router.get(
  "/export/class/:classId",
  authorize("ADMIN", "SURVEILLANT"),
  validateParams({ classId: z.string().uuid() }),
  incidentController.exportForClass
);
router.post("/", authorize("ADMIN", "SURVEILLANT", "TEACHER"), incidentController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, incidentController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, incidentController.remove);

export default router;
