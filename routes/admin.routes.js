import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  getPendingProducts,
  approveProduct,
  rejectProduct,
} from "../controllers/admin.controller.js";

const router = express.Router();

// GET PENDING PRODUCTS
router.get(
  "/products/pending",
  verifyToken,
  allowRoles("admin"),
  getPendingProducts
);

// APPROVE PRODUCT
router.put(
  "/products/:id/approve",
  verifyToken,
  allowRoles("admin"),
  approveProduct
);

// REJECT PRODUCT
router.put(
  "/products/:id/reject",
  verifyToken,
  allowRoles("admin"),
  rejectProduct
);

// GET REGISTERED USERS
router.get(
  "/users",
  verifyToken,
  allowRoles("admin"),
  // lazy-load controller to avoid circular import issues
  (req, res, next) => import("../controllers/admin.controller.js").then(m => m.getAllUsers(req, res, next)).catch(next)
);

// GET ORDERS TODAY
router.get(
  "/orders/today",
  verifyToken,
  allowRoles("admin"),
  (req, res, next) => import("../controllers/admin.controller.js").then(m => m.getOrdersToday(req, res, next)).catch(next)
);

export default router;