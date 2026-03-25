import Product from "../models/Product.js";

// ================= ADD PRODUCT =================
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, brand } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    const images = req.files ? req.files.map(file => file.path) : [];

    const product = await Product.create({
      name,
      description,
      price,
      category,
      brand,
      stock,
      images,
      seller: req.user._id,
      status: "pending", // 👈 important
    });

    res.status(201).json({
      message: "Product submitted for approval",
      product,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ================= GET SELLER PRODUCTS =================
export const getSellerProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user._id });

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= GET APPROVED PRODUCTS (USER SIDE) =================
export const getApprovedProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "approved" }).populate("seller", "brandName");

    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};