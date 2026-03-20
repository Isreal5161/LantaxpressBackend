import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import jwt from "jsonwebtoken";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";

// Load environment variables
dotenv.config();

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// Test JWT
const token = jwt.sign({ id: "123", role: "user" }, process.env.JWT_SECRET, {
  expiresIn: "7d"
});
console.log("Test token:", token);

// Routes
app.get("/", (req, res) => {
  res.send("LantaXpress Backend Running...");
});

app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});