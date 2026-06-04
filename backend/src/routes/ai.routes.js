import express from "express";
import { previewDamage, processDamage } from "../controllers/ai.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/analyze", authMiddleware, authorizeRoles("WORKSHOP"), previewDamage);
router.post("/process", authMiddleware, authorizeRoles("WORKSHOP"), processDamage);

export default router;