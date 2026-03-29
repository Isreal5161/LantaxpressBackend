import Order from "../models/Order.js";
import Product from "../models/Product.js";

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

    const now = new Date();
    const createdOrders = [];

    for (const cartItem of cartItems) {
      const productId = (cartItem.id || cartItem.productId || "").toString();
      const product = productMap.get(productId);

      if (!product) {
        return res.status(400).json({ message: `Product is no longer available: ${cartItem.name || productId}` });
      }

      const quantity = Math.max(1, Number(cartItem.quantity) || 1);
      const unitPrice = Number(product.price) || 0;
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
        amount: unitPrice * quantity,
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
    res.json(serializeOrder(saved));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to confirm delivery" });
  }
};

export const addOrderReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment?.trim()) {
      return res.status(400).json({ message: "Rating and comment are required" });
    }

    const order = await Order.findById(req.params.id).populate("buyer", "name email");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isOrderOwnedByUser(order, req.user)) {
      return res.status(403).json({ message: "Not authorized to review this order" });
    }

    order.review = {
      rating: Number(rating),
      comment: comment.trim(),
      date: new Date(),
    };

    await order.save();

    const saved = await Order.findById(order._id).populate("buyer", "name email").populate("seller", "brandName email");
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
    res.json(serializeOrder(saved));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update status" });
  }
};