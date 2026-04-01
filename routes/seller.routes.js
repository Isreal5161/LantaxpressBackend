import express from "express";
import { requireApprovedSeller, verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  addProduct,
  getSellerProducts,
} from "../controllers/product.controller.js";
import { updateProduct, deleteProduct } from "../controllers/product.controller.js";
import {
  createSellerWithdrawal,
  getSellerPlatformFees,
  getSellerFinanceSummary,
  getSellerWithdrawals,
} from "../controllers/finance.controller.js";

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Cloudinary storage for product media
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype?.startsWith("video/");

    return {
      folder: isVideo ? "products/videos" : "products/images",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo ? ["mp4", "mov", "webm", "m4v"] : ["jpg", "png", "jpeg", "webp"],
    };
  },
});

const upload = multer({ storage });

// ================= ADD PRODUCT =================
router.post(
  "/add-product",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "video", maxCount: 1 },
  ]),
  addProduct
);

// ================= GET SELLER PRODUCTS =================
router.get(
  "/my-products",
  verifyToken,
  allowRoles("seller"),
  getSellerProducts
);

// ================= SELLER DASHBOARD STATS =================
router.get(
  "/dashboard",
  verifyToken,
  allowRoles("seller"),
  // lazy-load controller to avoid circular deps
  async (req, res, next) => {
    try {
      const { getSellerDashboard } = await import("../controllers/product.controller.js");
      return getSellerDashboard(req, res, next);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/platform-fees",
  verifyToken,
  allowRoles("seller"),
  getSellerPlatformFees
);

router.get(
  "/finance/summary",
  verifyToken,
  allowRoles("seller"),
  getSellerFinanceSummary
);

router.get(
  "/withdrawals",
  verifyToken,
  allowRoles("seller"),
  getSellerWithdrawals
);

router.post(
  "/withdrawals",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  createSellerWithdrawal
);

// ================= UPDATE PRODUCT (SELLER) =================
router.put(
  "/products/:id",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "video", maxCount: 1 },
  ]),
  updateProduct
);

// ================= DELETE PRODUCT (SELLER) =================
router.delete(
  "/products/:id",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  deleteProduct
);

export default router;