import { Router } from "express";
import { calendarController } from "../controllers/calendar.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/", calendarController.list); // visible à tous les rôles connectés (admin, surveillant, professeur, parent)
router.post("/", authorize("ADMIN", "SURVEILLANT"), calendarController.create);
router.put("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, calendarController.update);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, calendarController.remove);

export default router;
