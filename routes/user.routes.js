import express from "express";
import { getApprovedProducts } from "../controllers/product.controller.js";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/User.js";
import {
	clearAllNotifications,
	getSortedNotifications,
	markAllNotificationsRead,
	markNotificationRead,
} from "../utils/notifications.js";

const router = express.Router();

router.get("/products", getApprovedProducts);

// Get current user's notifications
router.get('/notifications', verifyToken, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('notifications');
		res.json(getSortedNotifications(user?.notifications || []));
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Mark a notification read
router.put('/notifications/:id/read', verifyToken, async (req, res) => {
	try {
		const result = await markNotificationRead(User, req.user._id, req.params.id);
		res.status(result.status).json(result.body);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

router.put('/notifications/read-all', verifyToken, async (req, res) => {
	try {
		const result = await markAllNotificationsRead(User, req.user._id);
		res.status(result.status).json(result.body);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

router.delete('/notifications', verifyToken, async (req, res) => {
	try {
		const result = await clearAllNotifications(User, req.user._id);
		res.status(result.status).json(result.body);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

export default router;