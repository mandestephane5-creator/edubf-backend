import { Router } from "express";
import authRoutes from "./auth.routes";
import studentRoutes from "./student.routes";
import parentRoutes from "./parent.routes";
import classRoutes from "./class.routes";
import subjectRoutes from "./subject.routes";
import gradeRoutes from "./grade.routes";
import incidentRoutes from "./incident.routes";
import timetableRoutes from "./timetable.routes";
import evaluationRoutes from "./evaluation.routes";
import notificationRoutes from "./notification.routes";
import miscRoutes from "./misc.routes";

const router = Router();

// Doit être déclarée AVANT les routes protégées (miscRoutes exige une authentification
// sur tout ce qui est monté sous "/", ce qui interceptait /health par erreur)
router.get("/health", (_req, res) => {
  res.json({ success: true, message: "EduBF API opérationnelle", timestamp: new Date().toISOString() });
});

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/parents", parentRoutes);
router.use("/classes", classRoutes);
router.use("/subjects", subjectRoutes);
router.use("/grades", gradeRoutes);
router.use("/incidents", incidentRoutes);
router.use("/timetable", timetableRoutes);
router.use("/evaluations", evaluationRoutes);
router.use("/notifications", notificationRoutes);
router.use("/", miscRoutes);

export default router;
