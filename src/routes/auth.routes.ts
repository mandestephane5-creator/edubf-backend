import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Limite stricte spécifique à la connexion (en plus du blocage par compte après échecs)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de tentatives. Réessayez dans quelques minutes." },
});

router.post("/register-school", authController.registerSchool);
router.post("/login", loginLimiter, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.me);

router.post("/forgot-password", loginLimiter, authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

router.put("/change-parent-password", authenticate, authorize("PARENT"), authController.changeParentPassword);
router.put("/change-password", authenticate, authorize("TEACHER"), authController.changeParentPassword);

export default router;
