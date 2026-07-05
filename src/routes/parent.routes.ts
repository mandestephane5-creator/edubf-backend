import { Router } from "express";
import rateLimit from "express-rate-limit";
import { parentController } from "../controllers/parent.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { validateIdParam } from "../middlewares/validate.middleware";

const router = Router();
router.use(authenticate);

// Même sensibilité que la connexion : limite dédiée contre le brute-force
const linkChildLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de tentatives. Réessayez dans quelques minutes." },
});

router.get("/", authorize("ADMIN", "SURVEILLANT"), parentController.list);
router.get("/me/children", authorize("PARENT"), parentController.myChildren);
router.post("/me/link-child", authorize("PARENT"), linkChildLimiter, parentController.linkExistingChild);
router.get("/:id", authorize("ADMIN", "SURVEILLANT"), validateIdParam, parentController.getById);
router.post("/:id/reset-password", authorize("ADMIN"), validateIdParam, parentController.resetPassword);

export default router;
