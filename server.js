import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import jwt from "jsonwebtoken";
import cors from "cors";

// Routes
import authRoutes from "./routes/auth.routes.js";
import sellerRoutes from "./routes/seller.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import orderRoutes from "./routes/order.routes.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(express.json()); // <--- ADD THIS BEFORE ROUTES

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://lantaexpress-teal.vercel.app"
    ],
    credentials: true,
  })
);

// ✅ Optional: Test JWT (remove in production)
const token = jwt.sign(
  { id: "123", role: "user" },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);
console.log("Test token:", token);

// Test route
app.get("/", (req, res) => {
  res.send("LantaXpress Backend Running...");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/orders", orderRoutes);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Server error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});