import mongoose from "mongoose";

const sellerWithdrawalSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    method: { type: String, default: "Bank Transfer" },
    accountName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    adminNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("SellerWithdrawal", sellerWithdrawalSchema);