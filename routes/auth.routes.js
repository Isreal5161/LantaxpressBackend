import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyToken, authorizeRoles } from "../middleware/auth.js";
import { notifyAdmins, notifyUser } from "../utils/notifications.js";
import { sanitizeCategorySelection } from "../utils/categories.js";

import cloudinary from "../config/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import {
  getCurrentUser,
  loginAdmin,
  loginUser,
  updateCurrentUser,
} from "../controllers/auth.controller.js";

const router = express.Router();

// Simple in-memory rate limiter for admin login (suitable for temporary protection).
// Note: for production use a shared store (Redis) and a battle-tested library.
const loginAttempts = new Map();
const ADMIN_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const ADMIN_MAX_ATTEMPTS = 8;

function adminRateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const key = `admin:${ip}`;
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, first: now };

  if (now - entry.first > ADMIN_LIMIT_WINDOW) {
    entry.count = 0;
    entry.first = now;
  }

  entry.count += 1;
  loginAttempts.set(key, entry);

  if (entry.count > ADMIN_MAX_ATTEMPTS) {
    return res.status(429).json({ message: "Too many login attempts. Try again later." });
  }

  // attach remaining attempts info (optional)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, ADMIN_MAX_ATTEMPTS - entry.count));
  next();
}

router.post("/admin/login", adminRateLimit, loginAdmin);

// ================= CLOUDINARY =================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "lantaxpress",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

// ================= REGISTER =================
router.post("/register", upload.single("logo"), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      country,
      role,
      brandName,
      description,
      categories,
      state,
      address,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    // ❌ BLOCK ADMIN REGISTRATION
    if (role === "admin") {
      return res.status(403).json({
        message: "Admin cannot be registered publicly",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUserData = {
      name,
      email,
      phone,
      country: country || "Nigeria",
      password: hashedPassword,
      role: role === "seller" ? "seller" : "user",
    };

    // ✅ SELLER DATA
    if (role === "seller") {
      let parsedCategories = [];

      if (categories) {
        parsedCategories = JSON.parse(categories);
      }

      newUserData.brandName = brandName;
      newUserData.description = description;
      newUserData.categories = await sanitizeCategorySelection(parsedCategories);
      newUserData.state = state;
      newUserData.address = address;
      newUserData.sellerApprovalStatus = "pending";
      newUserData.sellerApprovalReviewedAt = null;

      if (req.file) {
        newUserData.logo = req.file.path;
      }
    }

    const user = await User.create(newUserData);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...safeUser } = user.toObject();

    if (user.role === "seller") {
      await Promise.all([
        notifyAdmins({
          type: "seller:request",
          message: `${user.brandName || user.name || "A seller"} registered and is waiting for approval.`,
          meta: {
            sellerId: user._id,
            sellerName: user.name,
            brandName: user.brandName,
            approvalStatus: user.sellerApprovalStatus || "pending",
          },
        }),
        notifyUser(user._id, {
          type: "seller:approval_pending",
          message: "Your seller account is pending admin approval. You can sign in and view your dashboard, but seller actions stay locked until approval.",
          meta: { approvalStatus: user.sellerApprovalStatus || "pending" },
        }),
      ]);
    }

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ================= LOGIN =================
router.post("/login", loginUser);

// ================= CURRENT USER =================
router.get("/me", verifyToken, getCurrentUser);
router.put("/me", verifyToken, upload.single("logo"), updateCurrentUser);

// ================= ADMIN TEST ROUTE =================
router.get(
  "/admin-only",
  verifyToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({ message: "Welcome Admin 👑" });
  }
);

// ================= UPLOAD AVATAR =================
router.post(
  "/upload-avatar",
  verifyToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      const user = await User.findById(req.user._id);
      user.avatar = req.file.path;
      await user.save();

      res.json({
        message: "Avatar uploaded successfully",
        user,
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;