import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";

// GET ALL PENDING PRODUCTS
export const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "pending" }).populate("seller", "brandName email");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// APPROVE PRODUCT //
export const approveProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product approved", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REJECT PRODUCT
export const rejectProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product rejected", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL REGISTERED USERS
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ORDERS SUMMARY FOR TODAY
export const getOrdersToday = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } });
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((acc, o) => acc + (o.amount || 0), 0);

    res.json({ totalOrders, totalAmount, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};