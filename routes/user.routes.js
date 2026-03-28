import express from "express";
import { getApprovedProducts } from "../controllers/product.controller.js";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/user.js";

const router = express.Router();

router.get("/products", getApprovedProducts);

// Get current user's notifications
router.get('/notifications', verifyToken, async (req, res) => {
	try {
		const user = await User.findById(req.user._id).select('notifications');
		res.json(user.notifications || []);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

// Mark a notification read
router.put('/notifications/:id/read', verifyToken, async (req, res) => {
	try {
		const user = await User.findById(req.user._id);
		if (!user) return res.status(404).json({ message: 'User not found' });
		const nid = req.params.id;
		const note = user.notifications.id(nid) || user.notifications.find(n => n._id && n._id.toString() === nid);
		if (!note) return res.status(404).json({ message: 'Notification not found' });
		note.read = true;
		await user.save();
		res.json({ message: 'Marked read' });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
});

export default router;