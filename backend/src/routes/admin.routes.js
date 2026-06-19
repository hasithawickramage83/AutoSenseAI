import express from "express";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listVehicleModels,
  createVehicleModel,
  updateVehicleModel,
  deleteVehicleModel,
  listParts,
  createPart,
  updatePart,
  deletePart,
  listStock,
  createStock,
  updateStock,
  upsertStockByPart,
  deleteStock,
  getInventory,
  getInventoryDashboard,
} from "../controllers/admin.controller.js";
import {
  listVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../controllers/vendor.controller.js";
import {
  listVehicleMakes,
  createVehicleMake,
  updateVehicleMake,
  deleteVehicleMake,
  listCatalogVehicleModels,
  createCatalogVehicleModel,
  updateCatalogVehicleModel,
  deleteCatalogVehicleModel,
} from "../controllers/vehicleMake.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = express.Router();
const adminOnly = [authMiddleware, authorizeRoles("ADMIN")];

// Users
router.get("/users", ...adminOnly, listUsers);
router.post("/users", ...adminOnly, createUser);
router.put("/users/:id", ...adminOnly, updateUser);
router.delete("/users/:id", ...adminOnly, deleteUser);

// Vehicle models
router.get("/vehicle-models", ...adminOnly, listVehicleModels);
router.post("/vehicle-models", ...adminOnly, createVehicleModel);
router.put("/vehicle-models/:id", ...adminOnly, updateVehicleModel);
router.delete("/vehicle-models/:id", ...adminOnly, deleteVehicleModel);

// Parts
router.get("/parts", ...adminOnly, listParts);
router.post("/part", ...adminOnly, createPart);
router.put("/parts/:id", ...adminOnly, updatePart);
router.delete("/parts/:id", ...adminOnly, deletePart);

// Stock
router.get("/inventory", ...adminOnly, getInventory);
router.get("/inventory/dashboard", ...adminOnly, getInventoryDashboard);
router.get("/stock", ...adminOnly, listStock);
router.post("/stock", ...adminOnly, createStock);
router.put("/stock/:id", ...adminOnly, updateStock);
router.patch("/stock/by-part", ...adminOnly, upsertStockByPart);
router.delete("/stock/:id", ...adminOnly, deleteStock);

// Vehicle makes & catalog models (for vendor specialization)
router.get("/vehicle-makes", ...adminOnly, listVehicleMakes);
router.post("/vehicle-makes", ...adminOnly, createVehicleMake);
router.put("/vehicle-makes/:id", ...adminOnly, updateVehicleMake);
router.delete("/vehicle-makes/:id", ...adminOnly, deleteVehicleMake);

router.get("/catalog-vehicle-models", ...adminOnly, listCatalogVehicleModels);
router.post("/catalog-vehicle-models", ...adminOnly, createCatalogVehicleModel);
router.put("/catalog-vehicle-models/:id", ...adminOnly, updateCatalogVehicleModel);
router.delete("/catalog-vehicle-models/:id", ...adminOnly, deleteCatalogVehicleModel);

// Vendors
router.get("/vendors", ...adminOnly, listVendors);
router.get("/vendors/:id", ...adminOnly, getVendor);
router.post("/vendors", ...adminOnly, createVendor);
router.put("/vendors/:id", ...adminOnly, updateVendor);
router.delete("/vendors/:id", ...adminOnly, deleteVendor);

export default router;
