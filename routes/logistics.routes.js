import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roles.js";
import {
  createLogisticsBooking,
  getAdminLogisticsRequests,
  quoteLogistics,
  trackLogisticsByTrackingId,
  updateAdminLogisticsStatus,
} from "../controllers/logistics.controller.js";

const router = express.Router();

router.post("/quote", quoteLogistics);
router.post("/bookings", verifyToken, allowRoles("user"), createLogisticsBooking);
router.get("/track/:trackingId", verifyToken, allowRoles("user"), trackLogisticsByTrackingId);

router.get("/admin/requests", verifyToken, allowRoles("admin"), getAdminLogisticsRequests);
router.patch("/admin/requests/:id/status", verifyToken, allowRoles("admin"), updateAdminLogisticsStatus);

export default router;