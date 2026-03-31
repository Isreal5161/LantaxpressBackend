import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { notifyAdmins, notifyUser } from "../utils/notifications.js";
import { calculateProductCharge, getPlatformFeeSettings } from "../utils/platformFees.js";
import { getProductSellingPrice } from "../utils/productPricing.js";

const ORDER_STAGES = [
  "Pending",
  "Approved",
  "Processing",
  "Shipped",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Cancelled",
];

const buildOrderNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${stamp}-${random}`;
};

const toStageObject = (stageMap) => {
  if (!stageMap) return {};
  if (stageMap instanceof Map) {
    return Object.fromEntries(stageMap.entries());
  }
  return stageMap;
};

const serializeOrder = (order) => {
  const firstItem = order.items?.[0] || {};
  const buyerName = order.contact?.name || order.buyer?.name || order.buyer?.email || "Customer";
  const buyerEmail = order.contact?.email || order.buyer?.email || "";

  return {
    recordId: order._id,
    id: order.orderNumber,
    orderNumber: order.orderNumber,
    buyerId: order.buyer?._id || order.buyer,
    sellerId: order.seller?._id || order.seller,
    userName: buyerName,
    buyer: buyerName,
    contact: buyerEmail,
    userEmail: buyerEmail,
    phone: order.contact?.phone || "",
    productId: firstItem.productId?._id || firstItem.productId || null,
    productName: firstItem.name || "Product",
    brand: firstItem.brand || order.seller?.brandName || "",
    image: firstItem.image || "/placeholder.png",
    description: firstItem.description || "",
    quantity: firstItem.quantity || 1,
    unitPrice: firstItem.price || 0,
    price: firstItem.price || 0,
    amount: order.amount || 0,
    currency: order.currency || "NGN",
    paymentMethod: order.paymentMethod || "card",
    status: order.status,
    stageTimestamps: toStageObject(order.stageTimestamps),
    expectedDelivery: order.expectedDelivery,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    received: order.received || false,
    receivedAt: order.receivedAt || null,
    review: order.review || null,
  };
};

const isOrderOwnedByUser = (order, user) => {
  if (!order || !user) return false;

  const orderBuyerId = order.buyer?._id?.toString?.() || order.buyer?.toString?.() || "";
  const currentUserId = user._id?.toString?.() || "";

  if (orderBuyerId && currentUserId && orderBuyerId === currentUserId) {
    return true;
  }

  const normalizedUserEmail = (user.email || "").trim().toLowerCase();
  const buyerEmail = (order.contact?.email || order.buyer?.email || "").trim().toLowerCase();

  return Boolean(normalizedUserEmail && buyerEmail && normalizedUserEmail === buyerEmail);
};

export const createOrders = async (req, res) => {
  try {
    const { cartItems, shippingAddress, paymentMethod, currency } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart items are required" });
    }

    if (!shippingAddress?.address || !shippingAddress?.city || !shippingAddress?.state || !shippingAddress?.phone) {
      return res.status(400).json({ message: "Complete shipping details are required" });
    }

    const productIds = cartItems.map((item) => item.id || item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds }, status: "approved" }).populate("seller", "brandName email");
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    const feeSettings = await getPlatformFeeSettings();
    const productChargePercent = Number(feeSettings?.productChargePercent) || 0;

    const now = new Date();
    const createdOrders = [];

    for (const cartItem of cartItems) {
      const productId = (cartItem.id || cartItem.productId || "").toString();
      const product = productMap.get(productId);

      if (!product) {
        return res.status(400).json({ message: `Product is no longer available: ${cartItem.name || productId}` });
      }

      const quantity = Math.max(1, Number(cartItem.quantity) || 1);
      const unitPrice = getProductSellingPrice(product);
      const grossAmount = unitPrice * quantity;
      const productCharge = calculateProductCharge(grossAmount, productChargePercent);
      const order = await Order.create({
        orderNumber: buildOrderNumber(),
        buyer: req.user._id,
        seller: product.seller?._id || product.seller,
        contact: {
          name: shippingAddress.name || req.user.name || "Customer",
          email: shippingAddress.email || req.user.email,
          phone: shippingAddress.phone,
        },
        shippingAddress: {
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zip: shippingAddress.zip || "",
          country: shippingAddress.country || "",
        },
        paymentMethod: paymentMethod || "card",
        currency: currency || "NGN",
        items: [
          {
            productId: product._id,
            seller: product.seller?._id || product.seller,
            name: product.name,
            brand: product.seller?.brandName || product.brand || "Generic",
            image: product.images?.[0] || cartItem.image || "/placeholder.png",
            description: product.description || cartItem.description || "",
            price: unitPrice,
            quantity,
          },
        ],
        amount: grossAmount,
        productChargePercent: productCharge.chargePercent,
        productChargeAmount: productCharge.chargeAmount,
        sellerNetAmount: productCharge.sellerNetAmount,
        status: "Pending",
        stageTimestamps: {
          Pending: now,
        },
        expectedDelivery: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      createdOrders.push(order);
    }

    const hydratedOrders = await Order.find({ _id: { $in: createdOrders.map((order) => order._id) } })
      .populate("buyer", "name email")
      .populate("seller", "brandName email")
      .sort({ createdAt: -1 });

    await Promise.allSettled([
      notifyUser(req.user._id, {
        type: "payment:successful",
        message: `Your payment for ${hydratedOrders.length} order${hydratedOrders.length === 1 ? "" : "s"} was successful.`,
        meta: {
          orderIds: hydratedOrders.map((order) => order._id),
          orderNumbers: hydratedOrders.map((order) => order.orderNumber),
        },
      }),
      ...hydratedOrders.map((order) => {
        const item = order.items?.[0];
        return notifyUser(order.seller?._id || order.seller, {
          type: "order:placed",
          message: `A new order ${order.orderNumber} was placed for ${item?.name || "your product"}.`,
          meta: { orderId: order._id, orderNumber: order.orderNumber, status: order.status },
        });
      }),
      notifyAdmins({
        type: "order:new",
        message: `${req.user.name || req.user.email || "A customer"} placed ${hydratedOrders.length} new order${hydratedOrders.length === 1 ? "" : "s"}.`,
        meta: {
          orderIds: hydratedOrders.map((order) => order._id),
          orderNumbers: hydratedOrders.map((order) => order.orderNumber),
          buyerId: req.user._id,
          sellerIds: hydratedOrders.map((order) => order.seller?._id || order.seller),
        },
      }),
      notifyAdmins({
        type: "payment:successful",
        message: `${req.user.name || req.user.email || "A customer"} completed payment for ${hydratedOrders.length} order${hydratedOrders.length === 1 ? "" : "s"}.`,
        meta: {
          orderIds: hydratedOrders.map((order) => order._id),
          orderNumbers: hydratedOrders.map((order) => order.orderNumber),
          buyerId: req.user._id,
          sellerIds: hydratedOrders.map((order) => order.seller?._id || order.seller),
        },
      }),
    ]);

    res.status(201).json({
      message: "Orders created successfully",
      primaryOrderNumber: hydratedOrders[0]?.orderNumber || null,
      orders: hydratedOrders.map(serializeOrder),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create order" });
  }
};

export const getBuyerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user._id })
      .populate("buyer", "name email")
      .populate("seller", "brandName email")
      .sort({ createdAt: -1 });

    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load orders" });
  }
};

export const trackOrderByNumber = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate("buyer", "name email")
      .populate("seller", "brandName email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isOrderOwnedByUser(order, req.user)) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(serializeOrder(order));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to track order" });
  }
};

export const confirmOrderReceived = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("buyer", "name email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isOrderOwnedByUser(order, req.user)) {
      return res.status(403).json({ message: "Not authorized to confirm this order" });
    }

    const receivedAt = new Date();
    order.status = "Completed";
    order.received = true;
    order.receivedAt = receivedAt;
    if (!order.stageTimestamps?.get?.("Completed") && !order.stageTimestamps?.Completed) {
      order.stageTimestamps.set("Completed", receivedAt);
    }

    await order.save();

    const saved = await Order.findById(order._id).populate("buyer", "name email").populate("seller", "brandName email");

    await Promise.allSettled([
      notifyUser(saved.seller?._id || saved.seller, {
        type: "order:completed",
        message: `Order ${saved.orderNumber} has been confirmed as received by the buyer.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, status: saved.status },
      }),
      notifyAdmins({
        type: "order:completed",
        message: `Order ${saved.orderNumber} was confirmed received by ${saved.buyer?.name || saved.buyer?.email || "the buyer"}.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, sellerId: saved.seller?._id || saved.seller },
      }),
    ]);

    res.json(serializeOrder(saved));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to confirm delivery" });
  }
};

export const addOrderReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const normalizedRating = Number(rating);

    if (!normalizedRating || !comment?.trim()) {
      return res.status(400).json({ message: "Rating and comment are required" });
    }

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5 stars" });
    }

    const order = await Order.findById(req.params.id).populate("buyer", "name email");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isOrderOwnedByUser(order, req.user)) {
      return res.status(403).json({ message: "Not authorized to review this order" });
    }

    if (!order.received || order.status !== "Completed") {
      return res.status(400).json({ message: "You can only review orders after confirming delivery" });
    }

    if (order.review) {
      return res.status(400).json({ message: "This order has already been reviewed" });
    }

    order.review = {
      rating: normalizedRating,
      comment: comment.trim(),
      date: new Date(),
    };

    await order.save();

    const saved = await Order.findById(order._id).populate("buyer", "name email").populate("seller", "brandName email");

    await Promise.allSettled([
      notifyUser(saved.seller?._id || saved.seller, {
        type: "order:review",
        message: `You received a new review for order ${saved.orderNumber}.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, rating: normalizedRating },
      }),
      notifyAdmins({
        type: "order:review",
        message: `A new review was submitted for order ${saved.orderNumber}.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, rating: normalizedRating },
      }),
    ]);

    res.json(serializeOrder(saved));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to save review" });
  }
};

export const getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user._id })
      .populate("buyer", "name email")
      .populate("seller", "brandName email")
      .sort({ createdAt: -1 });

    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load seller orders" });
  }
};

export const getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("buyer", "name email")
      .populate("seller", "brandName email")
      .sort({ createdAt: -1 });

    res.json(orders.map(serializeOrder));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load admin orders" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!ORDER_STAGES.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;

    if (!order.stageTimestamps?.get?.(status) && !order.stageTimestamps?.[status]) {
      order.stageTimestamps.set(status, new Date());
    }

    if (status === "Completed") {
      order.received = true;
      order.receivedAt = order.receivedAt || new Date();
    }

    await order.save();

    const saved = await Order.findById(order._id).populate("buyer", "name email").populate("seller", "brandName email");

    await Promise.allSettled([
      notifyUser(saved.buyer?._id || saved.buyer, {
        type: "order:status",
        message: `Your order ${saved.orderNumber} is now ${status}.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, status },
      }),
      notifyUser(saved.seller?._id || saved.seller, {
        type: "seller:order_status",
        message: `Order ${saved.orderNumber} has been updated to ${status}.`,
        meta: { orderId: saved._id, orderNumber: saved.orderNumber, status },
      }),
    ]);

    res.json(serializeOrder(saved));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update status" });
  }
};