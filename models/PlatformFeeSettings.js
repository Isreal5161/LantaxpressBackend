import mongoose from "mongoose";

const platformFeeSettingsSchema = new mongoose.Schema(
  {
    productChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    withdrawalChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    shippingFee: { type: Number, default: 0, min: 0 },
    deliveryMinDays: { type: Number, default: 2, min: 1, max: 30 },
    deliveryMaxDays: { type: Number, default: 5, min: 1, max: 30 },
    returnWindowDays: { type: Number, default: 7, min: 0, max: 60 },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformFeeSettings", platformFeeSettingsSchema);
