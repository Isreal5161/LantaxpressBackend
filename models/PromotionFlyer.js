import mongoose from "mongoose";

const promotionFlyerSchema = new mongoose.Schema(
  {
    section: {
      type: String,
      enum: ["home", "hot-sales", "flash-sales"],
      required: true,
      index: true,
    },
    title: { type: String, trim: true, default: "" },
    link: { type: String, trim: true, default: "/shop" },
    image: { type: String, required: true },
    imagePublicId: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("PromotionFlyer", promotionFlyerSchema);