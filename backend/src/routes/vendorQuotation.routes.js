import express from "express";
import {
  getVendorResponseForm,
  submitVendorResponse,
} from "../controllers/vendorQuotation.controller.js";

const router = express.Router();

router.get("/:token", getVendorResponseForm);
router.post("/:token", submitVendorResponse);

export default router;
