import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  addOrderReview,
  confirmOrderReceived,
  createOrders,
  getAdminOrders,
  getBuyerOrders,
  getSellerOrders,
  trackOrderByNumber,
  updateOrderStatus,
} from "../controllers/order.controller.js";

const router = express.Router();

router.get("/track/:orderNumber", trackOrderByNumber);

router.post("/", verifyToken, allowRoles("user"), createOrders);
router.get("/mine", verifyToken, allowRoles("user"), getBuyerOrders);
router.patch("/:id/confirm-received", verifyToken, allowRoles("user"), confirmOrderReceived);
router.post("/:id/review", verifyToken, allowRoles("user"), addOrderReview);

router.get("/seller", verifyToken, allowRoles("seller"), getSellerOrders);

router.get("/admin", verifyToken, allowRoles("admin"), getAdminOrders);
router.patch("/admin/:id/status", verifyToken, allowRoles("admin"), updateOrderStatus);

export default router;