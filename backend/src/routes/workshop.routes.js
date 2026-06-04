import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  getQuotations,
  getInvoices,
  getHistory,
  updateQuotation,
  deleteQuotation,
} from "../controllers/workshop.controller.js";

const router = express.Router();

router.use(authMiddleware, authorizeRoles("WORKSHOP"));

router.get("/quotations", getQuotations);
router.get("/invoices", getInvoices);
router.get("/history", getHistory);
router.put("/quotations/:id", updateQuotation);
router.delete("/quotations/:id", deleteQuotation);

export default router;
