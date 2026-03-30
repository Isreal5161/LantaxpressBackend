import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import { createCategory, listCategories } from "../controllers/category.controller.js";

const router = express.Router();

router.get("/", listCategories);
router.post("/", verifyToken, allowRoles("admin"), createCategory);

export default router;