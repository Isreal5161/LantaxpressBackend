import Product from "../models/Product.js";
import User from "../models/user.js";
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

    // notify seller
    try {
      const seller = await User.findById(product.seller);
      if (seller) {
        seller.notifications = seller.notifications || [];
        seller.notifications.unshift({
          type: 'product:approved',
          message: `Your product "${product.name}" was approved by admin.`,
          meta: { productId: product._id },
          read: false,
        });
        await seller.save();
      }
    } catch (nerr) {
      console.warn('Failed to notify seller on approve', nerr);
    }

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

    // notify seller
    try {
      const seller = await User.findById(product.seller);
      if (seller) {
        seller.notifications = seller.notifications || [];
        seller.notifications.unshift({
          type: 'product:rejected',
          message: `Your product "${product.name}" was rejected by admin.`,
          meta: { productId: product._id },
          read: false,
        });
        await seller.save();
      }
    } catch (nerr) {
      console.warn('Failed to notify seller on reject', nerr);
    }

    res.json({ message: "Product rejected", product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET ALL PRODUCTS (ADMIN)
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('seller', 'brandName email');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: update any product
export const adminUpdateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const { name, description, price, category, stock, brand, status } = req.body;
    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category) product.category = category;
    if (brand) product.brand = brand;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;

    if (req.files && req.files.length > 0) {
      const imgs = req.files.map(f => f.path);
      product.images = imgs.concat(product.images || []);
    }

    await product.save();

    // notify seller about admin edit
    try {
      const seller = await User.findById(product.seller);
      if (seller) {
        seller.notifications = seller.notifications || [];
        seller.notifications.unshift({
          type: 'product:admin_edit',
          message: `Admin updated your product "${product.name}".`,
          meta: { productId: product._id },
          read: false,
        });
        await seller.save();
      }
    } catch (nerr) {
      console.warn('Failed to notify seller on admin edit', nerr);
    }

    res.json({ message: 'Product updated by admin', product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: delete product
export const adminDeleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    await Product.deleteOne({ _id: id });

    // notify seller
    try {
      const seller = await User.findById(product.seller);
      if (seller) {
        seller.notifications = seller.notifications || [];
        seller.notifications.unshift({
          type: 'product:deleted_by_admin',
          message: `Admin deleted your product "${product.name}".`,
          meta: { productId: product._id },
          read: false,
        });
        await seller.save();
      }
    } catch (nerr) {
      console.warn('Failed to notify seller on admin delete', nerr);
    }

    res.json({ message: 'Product deleted by admin' });
  } catch (error) {
    console.error(error);
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