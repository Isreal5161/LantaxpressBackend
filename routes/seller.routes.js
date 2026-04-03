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

const PRODUCT_IMAGE_FORMATS = ["jpg", "png", "jpeg", "webp"];
const PRODUCT_VIDEO_FORMATS = ["mp4", "mov", "webm", "m4v"];

// Cloudinary storage for product images
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype?.startsWith("video/");

    return {
      folder: "products",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo ? PRODUCT_VIDEO_FORMATS : PRODUCT_IMAGE_FORMATS,
    };
  },
});

const upload = multer({ storage });
const uploadProductMedia = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "video", maxCount: 1 },
]);

// ================= ADD PRODUCT =================
router.post(
  "/add-product",
  verifyToken,
  allowRoles("seller"),
  requireApprovedSeller,
  uploadProductMedia,
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
  uploadProductMedia,
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