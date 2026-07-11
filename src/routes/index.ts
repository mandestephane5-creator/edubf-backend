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
import teacherRoutes from "./teacher.routes";
import validationRoutes from "./validation.routes";
import disruptiveRoutes from "./disruptive.routes";
import attendanceRoutes from "./attendance.routes";
import calendarRoutes from "./calendar.routes";
import credentialsExportRoutes from "./credentialsExport.routes";

const router = Router();

// Doit être déclarée AVANT les routes protégées (miscRoutes exige une authentification
// sur tout ce qui est monté sous "/", ce qui interceptait /health par erreur)
router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Vorelix API opérationnelle", timestamp: new Date().toISOString() });
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
router.use("/teachers", teacherRoutes);
router.use("/validation", validationRoutes);
router.use("/disruptive-reports", disruptiveRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/calendar-events", calendarRoutes);
router.use("/credentials-export", credentialsExportRoutes);
router.use("/", miscRoutes);

export default router;
