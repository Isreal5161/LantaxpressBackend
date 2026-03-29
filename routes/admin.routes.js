import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  getPendingProducts,
  approveProduct,
  rejectProduct,
} from "../controllers/admin.controller.js";
import { getAllProducts } from "../controllers/admin.controller.js";
import {
  getAdminSellerPayments,
  updateWithdrawalStatus,
} from "../controllers/finance.controller.js";

const router = express.Router();
import { adminUpdateProduct, adminDeleteProduct } from "../controllers/admin.controller.js";

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

// GET ALL PRODUCTS
router.get(
  "/products",
  verifyToken,
  allowRoles("admin"),
  getAllProducts
);

// ADMIN update product
router.put(
  "/products/:id",
  verifyToken,
  allowRoles("admin"),
  adminUpdateProduct
);

// ADMIN delete product
router.delete(
  "/products/:id",
  verifyToken,
  allowRoles("admin"),
  adminDeleteProduct
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

router.get(
  "/seller-payments",
  verifyToken,
  allowRoles("admin"),
  getAdminSellerPayments
);

router.patch(
  "/withdrawals/:id",
  verifyToken,
  allowRoles("admin"),
  updateWithdrawalStatus
);

export default router;