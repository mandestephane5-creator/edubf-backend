import { Router } from "express";
import { timetableController } from "../controllers/timetable.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.get("/class/:classId", authorize("ADMIN", "SURVEILLANT", "PARENT"), timetableController.getForClass);
router.post("/", authorize("ADMIN", "SURVEILLANT"), timetableController.createSlot);
router.delete("/:id", authorize("ADMIN", "SURVEILLANT"), timetableController.removeSlot);

export default router;
