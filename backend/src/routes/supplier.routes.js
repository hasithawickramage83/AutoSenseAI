import express from "express";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {
  getStock,
  getStockFilters,
  getQuotations,
  getAllQuotations,
  processQuotation,
  getInvoices,
  updateInvoice,
  sendInvoice,
  getPurchaseOrders,
  updatePurchaseOrderGroup,
  sendPurchaseOrderGroup,
  listWorkshops,
  createCustomQuotation,
} from "../controllers/supplier.controller.js";
import {
  listActiveVendors,
  sendVendorQuotationRequests,
  listVendorQuotationRequests,
  listVendorComparisonQuotations,
  getVendorQuotationComparison,
} from "../controllers/vendorQuotation.controller.js";

const router = express.Router();

router.use(authMiddleware, authorizeRoles("SUPPLIER"));

router.get("/stock", getStock);
router.get("/stock/filters", getStockFilters);
router.get("/workshops", listWorkshops);
router.post("/quotations/custom", createCustomQuotation);
router.get("/quotations", getQuotations);
router.get("/quotations/all", getAllQuotations);
router.post("/quotations/:id/process", processQuotation);
router.get("/invoices", getInvoices);
router.put("/invoices/:id", updateInvoice);
router.post("/invoices/:id/send", sendInvoice);
router.get("/purchase-orders", getPurchaseOrders);
router.put("/purchase-orders/:quotationId", updatePurchaseOrderGroup);
router.post("/purchase-orders/:quotationId/send", sendPurchaseOrderGroup);

// Vendor quotation collection
router.get("/vendors", listActiveVendors);
router.post("/vendor-quotations/send", sendVendorQuotationRequests);
router.get("/vendor-quotations/quotations-for-comparison", listVendorComparisonQuotations);
router.get("/vendor-quotations", listVendorQuotationRequests);
router.get("/vendor-quotations/:quotationId/comparison", getVendorQuotationComparison);

export default router;
