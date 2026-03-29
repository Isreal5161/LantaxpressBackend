import mongoose from "mongoose";

const platformFeeSettingsSchema = new mongoose.Schema(
  {
    productChargePercent: { type: Number, default: 0, min: 0, max: 100 },
    withdrawalChargePercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export default mongoose.model("PlatformFeeSettings", platformFeeSettingsSchema);
