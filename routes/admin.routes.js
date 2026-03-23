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

export default router;