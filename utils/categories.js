import Category from "../models/Category.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const defaultCategoryTitles = [
  "Electronics",
  "Fashion",
  "Home & Living",
  "Agriculture & Livestocks",
  "Phone/Device",
  "Perfumes & Cosmetics",
  "Beauty",
  "Home & Kitchen",
  "Groceries",
  "Phones & Accessories",
  "Computers",
  "Baby Products",
  "Sports",
  "Health",
  "Sports & Fitness",
  "Toys & Hobbies",
  "Automotive & Accessories",
  "Books & Stationery",
  "Used Materials",
  "Cereals",
];

export const normalizeCategoryTitle = (value = "") =>
  value
    .trim()
    .replace(/\s+/g, " ");

const toNormalizedCategoryTitle = (value = "") => normalizeCategoryTitle(value).toLowerCase();

export const ensureCategoryCatalog = async () => {
  const legacyProductCategories = await Product.distinct("category", {
    category: { $exists: true, $type: "string" },
  });
  const legacySellerCategories = await User.distinct("categories", {
    categories: { $exists: true, $ne: [] },
  });

  const desiredTitles = new Map();

  [...defaultCategoryTitles, ...legacyProductCategories, ...legacySellerCategories].forEach((title) => {
    const normalizedTitle = normalizeCategoryTitle(title || "");
    if (!normalizedTitle) {
      return;
    }

    desiredTitles.set(normalizedTitle.toLowerCase(), normalizedTitle);
  });

  const existingCategories = await Category.find({}, "normalizedTitle").lean();
  const existingNormalizedTitles = new Set(
    existingCategories.map((category) => category.normalizedTitle)
  );

  const operations = Array.from(desiredTitles.entries())
    .filter(([normalizedTitle]) => !existingNormalizedTitles.has(normalizedTitle))
    .map(([normalizedTitle, title]) => ({
      insertOne: {
        document: {
          title,
          normalizedTitle,
        },
      },
    }));

  if (operations.length > 0) {
    await Category.bulkWrite(operations);
  }
};

export const getAllCategories = async () => {
  await ensureCategoryCatalog();
  return Category.find({}).sort({ createdAt: 1, title: 1 });
};

export const assertCategoryExists = async (title) => {
  const normalizedTitle = normalizeCategoryTitle(title || "");

  if (!normalizedTitle) {
    throw new Error("Category is required");
  }

  await ensureCategoryCatalog();

  const category = await Category.findOne({
    normalizedTitle: toNormalizedCategoryTitle(normalizedTitle),
  });

  if (!category) {
    throw new Error("Selected category does not exist");
  }

  return category.title;
};

export const sanitizeCategorySelection = async (categories) => {
  const selectedCategories = Array.isArray(categories) ? categories : [];
  const normalizedCategories = [];
  const seenCategories = new Set();

  for (const category of selectedCategories) {
    const validatedCategory = await assertCategoryExists(category);
    const normalizedKey = validatedCategory.toLowerCase();

    if (seenCategories.has(normalizedKey)) {
      continue;
    }

    seenCategories.add(normalizedKey);
    normalizedCategories.push(validatedCategory);
  }

  return normalizedCategories;
};