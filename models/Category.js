import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    normalizedTitle: { type: String, required: true, unique: true, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

categorySchema.pre("validate", function syncNormalizedTitle(next) {
  if (typeof this.title === "string") {
    this.title = this.title.trim().replace(/\s+/g, " ");
    this.normalizedTitle = this.title.toLowerCase();
  }

  next();
});

export default mongoose.model("Category", categorySchema);