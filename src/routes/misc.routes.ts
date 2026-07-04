import { Router } from "express";
import { searchController, exportController, riskController, schoolController } from "../controllers/misc.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

// Recherche rapide
router.get("/search/students", authorize("ADMIN", "SURVEILLANT"), searchController.searchStudents);

// Export CSV — admin uniquement
router.get("/export/classes/:classId/students", authorize("ADMIN"), exportController.classList);
router.get("/export/classes/:classId/grades", authorize("ADMIN"), exportController.classGrades);

// Élèves à risque
router.get("/risk/students", authorize("ADMIN", "SURVEILLANT"), riskController.list);

// Paramètres école + gestion des comptes surveillant (admin uniquement)
router.get("/school/settings", authorize("ADMIN", "SURVEILLANT"), schoolController.getSettings);
router.put("/school/settings", authorize("ADMIN"), schoolController.updateSettings);
router.get("/school/surveillants", authorize("ADMIN"), schoolController.listSurveillants);
router.post("/school/surveillants", authorize("ADMIN"), schoolController.createSurveillant);
router.delete("/school/surveillants/:id", authorize("ADMIN"), schoolController.deactivateSurveillant);

export default router;
