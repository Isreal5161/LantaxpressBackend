import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import Admin from "../models/Admin.js";
import {
  getPendingProducts,
  approveProduct,
  rejectProduct,
} from "../controllers/admin.controller.js";
import { getAllProducts } from "../controllers/admin.controller.js";
import {
  getAdminSellerPayments,
  updateAdminPlatformFees,
  updateWithdrawalStatus,
} from "../controllers/finance.controller.js";
import {
  clearAllNotifications,
  getSortedNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/notifications.js";

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
  "/platform-fees",
  verifyToken,
  allowRoles("admin"),
  updateAdminPlatformFees
);

router.patch(
  "/withdrawals/:id",
  verifyToken,
  allowRoles("admin"),
  updateWithdrawalStatus
);

router.get(
  "/notifications",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const admin = await Admin.findById(req.user._id).select("notifications");
      res.json(getSortedNotifications(admin?.notifications || []));
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to load notifications" });
    }
  }
);

router.put(
  "/notifications/:id/read",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const result = await markNotificationRead(Admin, req.user._id, req.params.id);
      res.status(result.status).json(result.body);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to update notification" });
    }
  }
);

router.put(
  "/notifications/read-all",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const result = await markAllNotificationsRead(Admin, req.user._id);
      res.status(result.status).json(result.body);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to update notifications" });
    }
  }
);

router.delete(
  "/notifications",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const result = await clearAllNotifications(Admin, req.user._id);
      res.status(result.status).json(result.body);
    } catch (error) {
      res.status(500).json({ message: error.message || "Failed to clear notifications" });
    }
  }
);

export default router;