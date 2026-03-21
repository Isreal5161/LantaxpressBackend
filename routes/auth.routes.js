import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";

// Cloudinary
import cloudinary from "../config/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Import login controller
import { loginUser } from "../controllers/auth.controller.js";

const router = express.Router();

// ================= CLOUDINARY STORAGE =================
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

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUserData = {
      name,
      email,
      password: hashedPassword,
      role: role || "user",
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

      // ✅ CLOUDINARY IMAGE URL
      if (req.file) {
        newUserData.logo = req.file.path; // Cloudinary URL
      }
    }

    const user = await User.create(newUserData);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ================= LOGIN =================
router.post("/login", loginUser);

// ================= GET CURRENT USER =================
router.get("/me", verifyToken, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ================= UPLOAD AVATAR =================
router.post(
  "/upload-avatar",
  verifyToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });

      const user = await User.findById(req.user.id);
      if (!user)
        return res.status(404).json({ message: "User not found" });

      user.avatar = req.file.path; // Cloudinary URL
      await user.save();

      res.json({
        message: "Avatar uploaded successfully",
        user,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;