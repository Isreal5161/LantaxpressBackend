import Category from "../models/Category.js";
import {
  assertCategoryExists,
  getAllCategories,
  normalizeCategoryTitle,
} from "../utils/categories.js";

const serializeCategory = (category) => ({
  _id: category._id,
  title: category.title,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

export const listCategories = async (req, res) => {
  try {
    const categories = await getAllCategories();
    res.json(categories.map(serializeCategory));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to load categories" });
  }
};

export const createCategory = async (req, res) => {
  try {
    const title = normalizeCategoryTitle(req.body?.title || "");

    if (!title) {
      return res.status(400).json({ message: "Category title is required" });
    }

    await getAllCategories();

    const existingCategory = await Category.findOne({ normalizedTitle: title.toLowerCase() });
    if (existingCategory) {
      return res.status(409).json({ message: "Category already exists" });
    }

    const category = await Category.create({
      title,
      createdBy: req.user?._id || null,
    });

    const validatedTitle = await assertCategoryExists(category.title);

    res.status(201).json({
      message: "Category created successfully",
      category: {
        ...serializeCategory(category),
        title: validatedTitle,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Failed to create category" });
  }
};