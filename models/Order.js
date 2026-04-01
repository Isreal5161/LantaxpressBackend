import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, required: true },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contact: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    paymentMethod: { type: String, default: "card" },
    currency: { type: String, default: "NGN" },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String, required: true },
        brand: { type: String, default: "" },
        image: { type: String, default: "" },
        description: { type: String, default: "" },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    amount: { type: Number, required: true },
    productChargePercent: { type: Number, default: 0 },
    productChargeAmount: { type: Number, default: 0 },
    sellerNetAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Processing",
        "Shipped",
        "In Transit",
        "Out for Delivery",
        "Delivered",
        "Completed",
        "Cancelled",
      ],
      default: "Pending",
    },
    stageTimestamps: {
      type: Map,
      of: Date,
      default: {},
    },
    expectedDelivery: { type: Date },
    received: { type: Boolean, default: false },
    receivedAt: { type: Date },
    stockDeductedAt: { type: Date, default: null },
    review: { type: reviewSchema, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
