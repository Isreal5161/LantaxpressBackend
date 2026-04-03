import Product from "../models/Product.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { notifyUser } from "../utils/notifications.js";
import { getSellerApprovalStatus } from "../utils/sellerApproval.js";
import { assertCategoryExists } from "../utils/categories.js";

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

    try {
      await notifyUser(product.seller, {
        type: 'product:approved',
        message: `Your product "${product.name}" was approved by admin.`,
        meta: { productId: product._id },
      });
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

    try {
      await notifyUser(product.seller, {
        type: 'product:rejected',
        message: `Your product "${product.name}" was rejected by admin.`,
        meta: { productId: product._id },
      });
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

    const {
      name,
      description,
      price,
      category,
      stock,
      brand,
      status,
      keyFeatures,
      discountPrice,
      discountPercent,
      discountEndsAt,
      isFlashSale,
      flashSaleEndsAt,
      isMostWanted,
    } = req.body;
    const parsedKeyFeatures = keyFeatures !== undefined
      ? String(keyFeatures)
          .split(/\r?\n|[•●◦▪]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : undefined;
    const parseOptionalNumber = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const parseOptionalDate = (value) => {
      if (value === undefined || value === null || value === '') {
        return null;
      }

      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const parseBoolean = (value) => {
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return undefined;
    };

    if (name) product.name = name;
    if (description) product.description = description;
    if (price !== undefined) product.price = price;
    if (category !== undefined) {
      try {
        product.category = await assertCategoryExists(category);
      } catch (categoryError) {
        return res.status(400).json({ message: categoryError.message });
      }
    }
    if (brand) product.brand = brand;
    if (parsedKeyFeatures !== undefined) product.keyFeatures = parsedKeyFeatures;
    if (stock !== undefined) product.stock = stock;
    if (status) product.status = status;

    if (discountPrice !== undefined) {
      const parsedDiscountPrice = parseOptionalNumber(discountPrice);
      product.discountPrice = parsedDiscountPrice;
    }

    if (discountPercent !== undefined) {
      const parsedDiscountPercent = parseOptionalNumber(discountPercent);
      product.discountPercent = parsedDiscountPercent;
    }

    if (discountEndsAt !== undefined) {
      product.discountEndsAt = parseOptionalDate(discountEndsAt);
    }

    const parsedFlashSale = parseBoolean(isFlashSale);
    if (parsedFlashSale !== undefined) {
      product.isFlashSale = parsedFlashSale;
      if (!parsedFlashSale) {
        product.flashSaleEndsAt = null;
      }
    }

    if (flashSaleEndsAt !== undefined) {
      product.flashSaleEndsAt = parseOptionalDate(flashSaleEndsAt);
    }

    const parsedMostWanted = parseBoolean(isMostWanted);
    if (parsedMostWanted !== undefined) {
      product.isMostWanted = parsedMostWanted;
    }

    if (req.files && req.files.length > 0) {
      const imgs = req.files.map(f => f.path);
      product.images = imgs.concat(product.images || []);
    }

    await product.save();

    try {
      await notifyUser(product.seller, {
        type: 'product:admin_edit',
        message: `Admin updated your product "${product.name}".`,
        meta: { productId: product._id },
      });
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

    try {
      await notifyUser(product.seller, {
        type: 'product:deleted_by_admin',
        message: `Admin deleted your product "${product.name}".`,
        meta: { productId: product._id },
      });
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
    const users = await User.find().select("name email role brandName isVerified sellerApprovalStatus address state phone createdAt").sort({ createdAt: -1 });
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

export const getSellerRequests = async (req, res) => {
  try {
    const sellers = await User.find({ role: "seller", sellerApprovalStatus: "pending" })
      .select("name email phone brandName description categories state address logo createdAt sellerApprovalStatus")
      .sort({ createdAt: -1 });

    res.json({ requests: sellers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const approveSellerRequest = async (req, res) => {
  try {
    const seller = await User.findOne({ _id: req.params.id, role: "seller" });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.sellerApprovalStatus = "approved";
    seller.sellerApprovalReviewedAt = new Date();
    seller.isVerified = true;
    await seller.save();

    await notifyUser(seller._id, {
      type: "seller:approved",
      message: "Your seller account has been approved by admin. You can now upload products and use seller features.",
      meta: { approvalStatus: seller.sellerApprovalStatus },
    });

    res.json({
      message: "Seller approved successfully",
      seller,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectSellerRequest = async (req, res) => {
  try {
    const seller = await User.findOne({ _id: req.params.id, role: "seller" });
    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    seller.sellerApprovalStatus = "rejected";
    seller.sellerApprovalReviewedAt = new Date();
    seller.isVerified = false;
    await seller.save();

    await notifyUser(seller._id, {
      type: "seller:rejected",
      message: "Your seller account request was reviewed but not approved by admin. Please update your seller information and contact support if needed.",
      meta: { approvalStatus: seller.sellerApprovalStatus },
    });

    res.json({
      message: "Seller request rejected",
      seller,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};