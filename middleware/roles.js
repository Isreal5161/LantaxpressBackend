export const allowRoles = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    const userSource = req.userSource || "user";

    if (roles.includes("admin")) {
      if (userRole === "admin" && userSource === "admin") return next();
      return res.status(403).json({ message: "Access denied" });
    }

    if (roles.includes("user") && (userRole === "user" || userRole === "seller" || userSource === "admin")) {
      return next();
    }

    if (roles.includes("seller") && (userRole === "seller" || userSource === "admin")) {
      return next();
    }

    if (roles.includes(userRole)) return next();

    return res.status(403).json({ message: "Access denied" });
  };
};