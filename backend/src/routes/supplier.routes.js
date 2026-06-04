import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  getStock,
  getQuotations,
  processQuotation,
  getInvoices,
  updateInvoice,
  sendInvoice,
  getPurchaseOrders,
  updatePurchaseOrderGroup,
  sendPurchaseOrderGroup,
} from "../controllers/supplier.controller.js";

const router = express.Router();

router.use(authMiddleware, authorizeRoles("SUPPLIER"));

router.get("/stock", getStock);
router.get("/quotations", getQuotations);
router.post("/quotations/:id/process", processQuotation);
router.get("/invoices", getInvoices);
router.put("/invoices/:id", updateInvoice);
router.post("/invoices/:id/send", sendInvoice);
router.get("/purchase-orders", getPurchaseOrders);
router.put("/purchase-orders/:quotationId", updatePurchaseOrderGroup);
router.post("/purchase-orders/:quotationId/send", sendPurchaseOrderGroup);

export default router;
