import express from "express";
import {
  getPublicVendorCatalog,
  registerVendorPublic,
} from "../controllers/publicVendor.controller.js";

const router = express.Router();

router.get("/vendor-catalog", getPublicVendorCatalog);
router.post("/vendor-register", registerVendorPublic);

export default router;
