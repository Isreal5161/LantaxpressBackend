import express from "express";
import { getApprovedProducts } from "../controllers/product.controller.js";

const router = express.Router();

router.get("/products", getApprovedProducts);

export default router;