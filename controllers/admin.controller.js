import Product from "../models/Product.js";

// GET ALL PENDING PRODUCTS
export const getPendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: "pending" }).populate("seller", "brandName email");
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// APPROVE PRODUCT
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