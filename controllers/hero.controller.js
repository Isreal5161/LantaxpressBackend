import cloudinary from "../config/cloudinary.js";
import HeroSlide from "../models/HeroSlide.js";

const serializeHeroSlide = (slide) => ({
  _id: slide._id,
  eyebrow: slide.eyebrow || "",
  title: slide.title || "",
  highlight: slide.highlight || "",
  desc: slide.desc || "",
  primaryText: slide.primaryText || "Shop now",
  primaryLink: slide.primaryLink || "/shop",
  secondaryText: slide.secondaryText || "Learn more",
  secondaryLink: slide.secondaryLink || "/shop",
  badge: slide.badge || "Featured",
  metrics: Array.isArray(slide.metrics) ? slide.metrics.filter(Boolean) : [],
  mediaUrl: slide.mediaUrl,
  mediaType: slide.mediaType || "image",
  imageFit: slide.imageFit || "object-contain",
  accent: slide.accent,
  surface: slide.surface,
  sortOrder: slide.sortOrder || 0,
  isActive: slide.isActive !== false,
});

const parseBoolean = (value, fallback = undefined) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const parseSortOrder = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseMetrics = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveMediaType = (file) => {
  if (!file?.mimetype) {
    return "image";
  }

  return file.mimetype.startsWith("video/") ? "video" : "image";
};

const resolveBodyMediaType = (value) => (value === "video" ? "video" : "image");

export const getPublicHeroSlides = async (req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
    res.json(slides.map(serializeHeroSlide));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load hero slides" });
  }
};

export const getAdminHeroSlides = async (req, res) => {
  try {
    const slides = await HeroSlide.find({}).sort({ sortOrder: 1, createdAt: -1 });
    res.json(slides.map(serializeHeroSlide));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load hero slides" });
  }
};

export const createHeroSlide = async (req, res) => {
  try {
    if (!req.file?.path && !req.body.mediaUrl) {
      return res.status(400).json({ message: "Hero media is required" });
    }

    const slide = await HeroSlide.create({
      eyebrow: req.body.eyebrow || "",
      title: req.body.title || "",
      highlight: req.body.highlight || "",
      desc: req.body.desc || "",
      primaryText: req.body.primaryText || "Shop now",
      primaryLink: req.body.primaryLink || "/shop",
      secondaryText: req.body.secondaryText || "Learn more",
      secondaryLink: req.body.secondaryLink || "/shop",
      badge: req.body.badge || "Featured",
      metrics: parseMetrics(req.body.metrics),
      mediaUrl: req.file?.path || req.body.mediaUrl,
      mediaPublicId: req.file?.filename || "",
      mediaType: req.file ? resolveMediaType(req.file) : resolveBodyMediaType(req.body.mediaType),
      imageFit: req.body.imageFit === "object-cover" ? "object-cover" : "object-contain",
      accent: req.body.accent || "from-emerald-600 via-green-600 to-lime-500",
      surface: req.body.surface || "from-emerald-50 via-white to-lime-50",
      sortOrder: parseSortOrder(req.body.sortOrder),
      isActive: parseBoolean(req.body.isActive, true),
    });

    res.status(201).json({ message: "Hero slide created", slide: serializeHeroSlide(slide) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create hero slide" });
  }
};

export const updateHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    if (req.body.eyebrow !== undefined) slide.eyebrow = req.body.eyebrow;
    if (req.body.title !== undefined) slide.title = req.body.title;
    if (req.body.highlight !== undefined) slide.highlight = req.body.highlight;
    if (req.body.desc !== undefined) slide.desc = req.body.desc;
    if (req.body.primaryText !== undefined) slide.primaryText = req.body.primaryText || "Shop now";
    if (req.body.primaryLink !== undefined) slide.primaryLink = req.body.primaryLink || "/shop";
    if (req.body.secondaryText !== undefined) slide.secondaryText = req.body.secondaryText || "Learn more";
    if (req.body.secondaryLink !== undefined) slide.secondaryLink = req.body.secondaryLink || "/shop";
    if (req.body.badge !== undefined) slide.badge = req.body.badge || "Featured";
    if (req.body.metrics !== undefined) slide.metrics = parseMetrics(req.body.metrics);
    if (req.body.imageFit !== undefined) slide.imageFit = req.body.imageFit === "object-cover" ? "object-cover" : "object-contain";
    if (req.body.accent !== undefined) slide.accent = req.body.accent;
    if (req.body.surface !== undefined) slide.surface = req.body.surface;
    if (req.body.sortOrder !== undefined) slide.sortOrder = parseSortOrder(req.body.sortOrder);

    const parsedIsActive = parseBoolean(req.body.isActive);
    if (parsedIsActive !== undefined) {
      slide.isActive = parsedIsActive;
    }

    if (req.file?.path) {
      if (slide.mediaPublicId) {
        try {
          await cloudinary.uploader.destroy(slide.mediaPublicId, { resource_type: slide.mediaType === "video" ? "video" : "image" });
        } catch (uploadError) {
          console.warn("Failed to remove old hero slide media", uploadError);
        }
      }

      slide.mediaUrl = req.file.path;
      slide.mediaPublicId = req.file.filename || "";
      slide.mediaType = resolveMediaType(req.file);
    } else if (req.body.mediaUrl !== undefined) {
      if (slide.mediaPublicId && req.body.mediaUrl !== slide.mediaUrl) {
        try {
          await cloudinary.uploader.destroy(slide.mediaPublicId, { resource_type: slide.mediaType === "video" ? "video" : "image" });
        } catch (uploadError) {
          console.warn("Failed to remove old hero slide media", uploadError);
        }
      }

      slide.mediaUrl = req.body.mediaUrl || slide.mediaUrl;
      slide.mediaPublicId = "";
      if (req.body.mediaType !== undefined) {
        slide.mediaType = resolveBodyMediaType(req.body.mediaType);
      }
    }

    await slide.save();

    res.json({ message: "Hero slide updated", slide: serializeHeroSlide(slide) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update hero slide" });
  }
};

export const deleteHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    if (slide.mediaPublicId) {
      try {
        await cloudinary.uploader.destroy(slide.mediaPublicId, { resource_type: slide.mediaType === "video" ? "video" : "image" });
      } catch (uploadError) {
        console.warn("Failed to remove hero slide media", uploadError);
      }
    }

    await HeroSlide.deleteOne({ _id: slide._id });
    res.json({ message: "Hero slide deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete hero slide" });
  }
};