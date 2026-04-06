import mongoose from "mongoose";

const heroSlideSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: "" },
    title: { type: String, trim: true, default: "" },
    highlight: { type: String, trim: true, default: "" },
    desc: { type: String, trim: true, default: "" },
    primaryText: { type: String, trim: true, default: "Shop now" },
    primaryLink: { type: String, trim: true, default: "/shop" },
    secondaryText: { type: String, trim: true, default: "Learn more" },
    secondaryLink: { type: String, trim: true, default: "/shop" },
    badge: { type: String, trim: true, default: "Featured" },
    metrics: [{ type: String, trim: true }],
    mediaUrl: { type: String, required: true },
    mediaPublicId: { type: String, default: "" },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    imageFit: {
      type: String,
      enum: ["object-contain", "object-cover"],
      default: "object-contain",
    },
    accent: { type: String, trim: true, default: "from-emerald-600 via-green-600 to-lime-500" },
    surface: { type: String, trim: true, default: "from-emerald-50 via-white to-lime-50" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

heroSlideSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export default mongoose.model("HeroSlide", heroSlideSchema);