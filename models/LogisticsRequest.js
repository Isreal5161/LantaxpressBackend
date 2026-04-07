import mongoose from "mongoose";

const logisticsRequestSchema = new mongoose.Schema(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    trackingId: { type: String, required: true, unique: true, index: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contact: {
      name: { type: String, required: true },
      email: { type: String, default: "" },
      phone: { type: String, required: true },
    },
    serviceType: { type: String, required: true, trim: true },
    urgency: { type: String, required: true, trim: true },
    pickupAddress: { type: String, required: true, trim: true },
    deliveryAddress: { type: String, required: true, trim: true },
    packageDescription: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    distanceMeters: { type: Number, default: 0 },
    distanceText: { type: String, default: "" },
    durationText: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    paymentMethod: { type: String, default: "card" },
    pricingSnapshot: {
      rateUnit: { type: String, enum: ["kilometer", "meter"], default: "kilometer" },
      rateValue: { type: Number, default: 0 },
      baseFee: { type: Number, default: 0 },
      minimumFee: { type: Number, default: 0 },
      calculator: { type: String, default: "google-maps" },
    },
    status: {
      type: String,
      enum: [
        "Awaiting Dispatch",
        "Approved",
        "Pickup Scheduled",
        "Picked Up",
        "In Transit",
        "Arrived at Nearest Hub",
        "Out for Delivery",
        "Delivered",
        "Completed",
        "Declined",
        "Cancelled",
      ],
      default: "Awaiting Dispatch",
    },
    stageTimestamps: {
      type: Map,
      of: Date,
      default: {},
    },
    adminNotes: { type: String, default: "" },
    received: { type: Boolean, default: false },
    receivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("LogisticsRequest", logisticsRequestSchema);