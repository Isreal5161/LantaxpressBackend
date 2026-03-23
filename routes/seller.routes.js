import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  addProduct,
  getSellerProducts,
} from "../controllers/product.controller.js";

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Cloudinary storage for product images
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

// ================= ADD PRODUCT =================
router.post(
  "/add-product",
  verifyToken,
  allowRoles("seller"),
  upload.array("images", 5),
  addProduct
);

// ================= GET SELLER PRODUCTS =================
router.get(
  "/my-products",
  verifyToken,
  allowRoles("seller"),
  getSellerProducts
);

export default router;