import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    country: { type: String, default: "Nigeria" },
    role: { type: String, enum: ["user", "seller", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },

    // Seller-specific fields
    brandName: { type: String },
    description: { type: String },
    categories: { type: [String] },
    logo: { type: String }, // store file path or URL
    state: { type: String },
    address: { type: String },
    // Notifications for users/sellers
    notifications: [
      {
        type: { type: String },
        message: { type: String },
        meta: { type: Object },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema); 