import { Router } from "express";
import { incidentController } from "../controllers/incident.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/", authorize("ADMIN", "SURVEILLANT", "PARENT"), incidentController.list);
router.post("/", authorize("ADMIN", "SURVEILLANT"), incidentController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), incidentController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), incidentController.remove);

export default router;
