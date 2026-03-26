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

// ================= UPDATE PRODUCT (SELLER) =================
export const updateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // only owner can edit
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, price, category, stock, brand } = req.body;

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (brand) product.brand = brand;
    if (stock !== undefined) product.stock = stock;

    // handle uploaded images
    if (req.files && req.files.length > 0) {
      const images = req.files.map(f => f.path);
      // append new images (keep existing ones)
      product.images = images.concat(product.images || []);
    }

    // if product was approved and seller edits, mark as pending for re-approval
    if (product.status === 'approved') {
      product.status = 'pending';
    }

    await product.save();

    res.json({ message: 'Product updated', product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE PRODUCT (SELLER) =================
export const deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // only owner or admin can delete - here sellers delete their own
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Product.deleteOne({ _id: id });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error(error);
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