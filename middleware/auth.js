import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

// ✅ VERIFY TOKEN
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try admin first (admin tokens must map to Admin collection)
    const admin = await Admin.findById(decoded.id).select("-password");
    if (admin) {
      req.user = admin;
      req.userSource = "admin";
      return next();
    }

    // Fallback to regular users
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Prevent privilege escalation: user documents should never have admin role
    if (user.role === "admin") {
      return res.status(401).json({ message: "Invalid token source" });
    }

    req.user = user;
    req.userSource = "user";
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({
      message: "Token is invalid or expired",
    });
  }
};

// ✅ ROLE-BASED ACCESS CONTROL
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userSource = req.userSource || "user";

    // Admin access must come from admin collection/token
    if (roles.includes("admin")) {
      if (userRole === "admin" && userSource === "admin") return next();
      return res.status(403).json({ message: "Access denied: admin only" });
    }

    // Sellers may act as users (allow seller for user-protected routes)
    if (roles.includes("user") && (userRole === "user" || userRole === "seller" || userSource === "admin")) {
      return next();
    }

    // Allow seller routes for sellers (and admins)
    if (roles.includes("seller") && (userRole === "seller" || userSource === "admin")) {
      return next();
    }

    // Generic check
    if (roles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ message: "Access denied: insufficient permissions" });
  };
};