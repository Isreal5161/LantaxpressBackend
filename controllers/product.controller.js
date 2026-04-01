import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { notifyAdmins } from "../utils/notifications.js";
import { normalizeProductPricing } from "../utils/productPricing.js";
import { getSellerApprovalMessage, getSellerApprovalStatus } from "../utils/sellerApproval.js";
import { assertCategoryExists } from "../utils/categories.js";

const buildReviewSummary = (reviews = []) => {
  const safeReviews = reviews.filter((review) => Number(review?.rating) >= 1 && Number(review?.rating) <= 5);
  const reviewCount = safeReviews.length;
  const totalRating = safeReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const averageRating = reviewCount > 0 ? Math.round((totalRating / reviewCount) * 10) / 10 : 0;
  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  safeReviews.forEach((review) => {
    const rating = Number(review.rating) || 0;
    if (ratingBreakdown[rating] !== undefined) {
      ratingBreakdown[rating] += 1;
    }
  });

  return {
    reviewCount,
    averageRating,
    ratingBreakdown,
  };
};

const serializeReview = (order) => ({
  orderId: order._id,
  orderNumber: order.orderNumber,
  rating: Number(order.review?.rating) || 0,
  comment: order.review?.comment || "",
  date: order.review?.date || order.updatedAt || order.createdAt,
  reviewerName: order.buyer?.name || order.contact?.name || "Verified buyer",
  verifiedBuyer: true,
});

const serializeProduct = (product, reviewData = {}) => ({
  ...product.toObject(),
  reviewCount: Number(reviewData.reviewCount) || 0,
  averageRating: Number(reviewData.averageRating) || 0,
  ratingBreakdown: reviewData.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  reviews: Array.isArray(reviewData.reviews) ? reviewData.reviews : [],
});

const getReviewSummaryMap = async (productIds = []) => {
  if (productIds.length === 0) {
    return new Map();
  }

  const aggregates = await Order.aggregate([
    {
      $match: {
        "items.productId": { $in: productIds },
        review: { $ne: null },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": { $in: productIds },
        review: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$items.productId",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$review.rating" },
        rating1: { $sum: { $cond: [{ $eq: ["$review.rating", 1] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ["$review.rating", 2] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ["$review.rating", 3] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ["$review.rating", 4] }, 1, 0] } },
        rating5: { $sum: { $cond: [{ $eq: ["$review.rating", 5] }, 1, 0] } },
      },
    },
  ]);

  return new Map(
    aggregates.map((entry) => [
      entry._id.toString(),
      {
        reviewCount: entry.reviewCount || 0,
        averageRating: Math.round((Number(entry.averageRating) || 0) * 10) / 10,
        ratingBreakdown: {
          1: entry.rating1 || 0,
          2: entry.rating2 || 0,
          3: entry.rating3 || 0,
          4: entry.rating4 || 0,
          5: entry.rating5 || 0,
        },
      },
    ]),
  );
};

const getDetailedReviewData = async (productId) => {
  const reviewedOrders = await Order.find({
    "items.productId": productId,
    review: { $ne: null },
  })
    .populate("buyer", "name")
    .sort({ "review.date": -1, updatedAt: -1, createdAt: -1 });

  const reviews = reviewedOrders.map(serializeReview);
  return {
    ...buildReviewSummary(reviews),
    reviews,
  };
};

const parseKeyFeatures = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n|[•●◦▪]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

// ================= ADD PRODUCT =================
export const addProduct = async (req, res) => {
  try {
    const { name, description, price, discountPrice, discountPercent, category, stock, brand, keyFeatures } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: "Name, price, and category are required" });
    }

    let pricing;
    try {
      pricing = normalizeProductPricing({ price, discountPrice, discountPercent });
    } catch (pricingError) {
      return res.status(400).json({ message: pricingError.message });
    }

    let validatedCategory;
    try {
      validatedCategory = await assertCategoryExists(category);
    } catch (categoryError) {
      return res.status(400).json({ message: categoryError.message });
    }

    const images = req.files ? req.files.map(file => file.path) : [];

    const product = await Product.create({
      name,
      description,
      price: pricing.price,
      discountPrice: pricing.discountPrice,
      discountPercent: pricing.discountPercent,
      category: validatedCategory,
      brand,
      keyFeatures: parseKeyFeatures(keyFeatures),
      stock,
      images,
      seller: req.user._id,
      status: "pending", // 👈 important
    });

    await notifyAdmins({
      type: "product:submitted",
      message: `${req.user.brandName || req.user.name || "A seller"} submitted "${product.name}" for approval.`,
      meta: { productId: product._id, sellerId: req.user._id, status: product.status },
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

    res.json({
      products,
      approvalStatus: getSellerApprovalStatus(req.user),
      approvalMessage: getSellerApprovalMessage(req.user),
    });
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

    const { name, description, price, discountPrice, discountPercent, category, stock, brand, keyFeatures } = req.body;

    let pricing;

    try {
      pricing = normalizeProductPricing({
        price: price !== undefined ? price : product.price,
        discountPrice: discountPrice !== undefined ? discountPrice : product.discountPrice,
        discountPercent: discountPercent !== undefined ? discountPercent : product.discountPercent,
      });
    } catch (pricingError) {
      return res.status(400).json({ message: pricingError.message });
    }

    if (name) product.name = name;
    if (description) product.description = description;
    product.price = pricing.price;
    product.discountPrice = pricing.discountPrice;
    product.discountPercent = pricing.discountPercent;
    if (category !== undefined) {
      try {
        product.category = await assertCategoryExists(category);
      } catch (categoryError) {
        return res.status(400).json({ message: categoryError.message });
      }
    }
    if (brand) product.brand = brand;
    if (keyFeatures !== undefined) product.keyFeatures = parseKeyFeatures(keyFeatures);
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

    if (product.status === "pending") {
      await notifyAdmins({
        type: "product:resubmitted",
        message: `${req.user.brandName || req.user.name || "A seller"} updated "${product.name}" and it is waiting for approval again.`,
        meta: { productId: product._id, sellerId: req.user._id, status: product.status },
      });
    }

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
    const reviewSummaryMap = await getReviewSummaryMap(products.map((product) => product._id));

    res.json(products.map((product) => serializeProduct(product, reviewSummaryMap.get(product._id.toString()))));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getApprovedProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, status: "approved" }).populate("seller", "brandName");

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const reviewData = await getDetailedReviewData(product._id);
    res.json(serializeProduct(product, reviewData));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= SELLER DASHBOARD STATS =================
export const getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user._id;

    // Fetch seller products
    const products = await Product.find({ seller: sellerId });
    const productIds = products.map(p => p._id);

    const productsListed = products.filter(p => p.status === 'approved').length;
    const productsPending = products.filter(p => p.status === 'pending').length;

    // Fetch orders that include seller's products
    const orders = await Order.find({ 'items.productId': { $in: productIds } }).populate('buyer', 'name email');

    // Compute revenue attributable to this seller (sum of item.price * quantity for items belonging to seller)
    let totalRevenue = 0;
    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (item.productId && productIds.find(id => id.toString() === item.productId.toString())) {
          totalRevenue += (item.price || 0) * (item.quantity || 0);
        }
      });
    });

    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;

    // recent orders (limit 5)
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(o => ({ id: o._id, buyer: o.buyer?.name || o.buyer?.email || 'Customer', amount: o.amount, status: o.status, date: o.createdAt }));

    // daily revenue for last 7 days
    const today = new Date();
    const last7 = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const dailyRevenue = last7.map(day => {
      let rev = 0;
      orders.forEach(order => {
        const orderDate = order.createdAt.toISOString().split('T')[0];
        if (orderDate === day) {
          (order.items || []).forEach(item => {
            if (item.productId && productIds.find(id => id.toString() === item.productId.toString())) {
              rev += (item.price || 0) * (item.quantity || 0);
            }
          });
        }
      });
      return { date: day, revenue: rev };
    });

    res.json({
      totalRevenue,
      totalOrders,
      productsListed,
      productsPending,
      pendingOrders,
      approvalStatus: getSellerApprovalStatus(req.user),
      approvalMessage: getSellerApprovalMessage(req.user),
      recentOrders,
      dailyRevenue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};