import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyToken, authorizeRoles } from "../middleware/auth.js";

import cloudinary from "../config/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import { loginUser } from "../controllers/auth.controller.js";

const router = express.Router();

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
      password,
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
      password: hashedPassword,
      role: role === "seller" ? "seller" : "user",
    };

    // ✅ SELLER DATA
    if (role === "seller") {
      newUserData.brandName = brandName;
      newUserData.description = description;
      newUserData.categories = categories
        ? JSON.parse(categories)
        : [];
      newUserData.state = state;
      newUserData.address = address;

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
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

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