import express from "express";

const router = express.Router();

// TEMP dashboard route
router.get("/dashboard", (req, res) => {
  res.json({
    success: true,
    message: "Seller dashboard data fetched successfully",
    data: {
      totalSales: 120000,
      totalOrders: 45,
      products: 12,
    },
  });
});

export default router;