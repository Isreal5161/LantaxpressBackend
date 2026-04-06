import mongoose from "mongoose";

const platformFeeSettingsSchema = new mongoose.Schema(
  {
    productChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    withdrawalChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    deliveryMinDays: { type: Number, default: 2, min: 1, max: 30 },
    deliveryMaxDays: { type: Number, default: 5, min: 1, max: 30 },
    returnWindowDays: { type: Number, default: 7, min: 0, max: 60 },
    shippingPolicyTitle: { type: String, trim: true, default: "Shipping Policy" },
    shippingPolicyContent: {
      type: String,
      trim: true,
      default:
        "Delivery timelines start from the day an order is placed. Home delivery is attempted within the stated delivery window, while pickup station orders are held for customer collection within the same period.",
    },
    returnPolicyTitle: { type: String, trim: true, default: "Return Policy" },
    returnPolicyContent: {
      type: String,
      trim: true,
      default:
        "Eligible items can be returned within the configured return window, provided they are unused and returned with their original packaging.",
    },
    pickupStationPolicyContent: {
      type: String,
      trim: true,
      default:
        "Pickup station delivery starts from the day you place your order until it arrives at your selected pickup station. You will be notified once it is ready for collection.",
    },
    homeDeliveryPolicyContent: {
      type: String,
      trim: true,
      default:
        "Home delivery starts from the day you place your order until the first delivery attempt at your address. Please keep your phone reachable during the delivery window.",
    },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformFeeSettings", platformFeeSettingsSchema);
