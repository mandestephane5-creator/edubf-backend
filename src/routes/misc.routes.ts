import { Router } from "express";
import { z } from "zod";
import {
  searchController,
  exportController,
  riskController,
  schoolController,
  announcementController,
  reportController,
  pushTokenController,
} from "../controllers/misc.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam, validateParams } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

router.get("/search/students", authorize("ADMIN", "SURVEILLANT"), searchController.searchStudents);

router.get(
  "/export/classes/:classId/students",
  authorize("ADMIN"),
  validateParams({ classId: z.string().uuid() }),
  exportController.classList
);
router.get(
  "/export/classes/:classId/grades",
  authorize("ADMIN"),
  validateParams({ classId: z.string().uuid() }),
  exportController.classGrades
);

router.get("/risk/students", authorize("ADMIN", "SURVEILLANT"), riskController.list);

router.get("/school/settings", authorize("ADMIN", "SURVEILLANT"), schoolController.getSettings);
router.put("/school/settings", authorize("ADMIN"), schoolController.updateSettings);
router.get("/school/surveillants", authorize("ADMIN"), schoolController.listSurveillants);
router.post("/school/surveillants", authorize("ADMIN"), schoolController.createSurveillant);
router.delete("/school/surveillants/:id", authorize("ADMIN"), validateIdParam, schoolController.deactivateSurveillant);

// Annonces (actualités) — lues par tout le monde, écrites par admin/surveillant
router.get("/announcements", authorize("ADMIN", "SURVEILLANT", "PARENT"), announcementController.list);
router.post("/announcements", authorize("ADMIN", "SURVEILLANT"), announcementController.create);
router.delete("/announcements/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, announcementController.remove);

// Signalements — créés par les parents, consultés par admin/surveillant
router.post("/reports", authorize("PARENT"), reportController.create);
router.get("/reports/me", authorize("PARENT"), reportController.listMine);
router.get("/reports", authorize("ADMIN", "SURVEILLANT"), reportController.list);
router.put("/reports/:id/resolve", authorize("ADMIN", "SURVEILLANT"), validateIdParam, reportController.markResolved);

// Jetons de notifications push — tout utilisateur authentifié peut enregistrer son appareil
router.post("/push-tokens", pushTokenController.register);

export default router;
