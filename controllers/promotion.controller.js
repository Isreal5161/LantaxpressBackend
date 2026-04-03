import cloudinary from "../config/cloudinary.js";
import PromotionFlyer from "../models/PromotionFlyer.js";

const serializePromotionFlyer = (flyer) => ({
  _id: flyer._id,
  section: flyer.section,
  title: flyer.title || "",
  link: flyer.link || "/shop",
  image: flyer.image,
  mediaType: flyer.mediaType || "image",
  sortOrder: flyer.sortOrder || 0,
  isActive: flyer.isActive !== false,
  createdAt: flyer.createdAt,
  updatedAt: flyer.updatedAt,
});

const resolveMediaType = (file) => {
  if (!file?.mimetype) {
    return "image";
  }

  return file.mimetype.startsWith("video/") ? "video" : "image";
};

const resolveBodyMediaType = (value) => (value === "video" ? "video" : "image");

const parseBoolean = (value, fallback = undefined) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
};

const parseSortOrder = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getPublicPromotionFlyers = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.section) {
      filter.section = req.query.section;
    }

    const flyers = await PromotionFlyer.find(filter).sort({ section: 1, sortOrder: 1, createdAt: -1 });
    res.json(flyers.map(serializePromotionFlyer));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load promotional flyers" });
  }
};

export const getAdminPromotionFlyers = async (req, res) => {
  try {
    const flyers = await PromotionFlyer.find({}).sort({ section: 1, sortOrder: 1, createdAt: -1 });
    res.json(flyers.map(serializePromotionFlyer));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load promotional flyers" });
  }
};

export const createPromotionFlyer = async (req, res) => {
  try {
    if (!req.file?.path && !req.body.image) {
      return res.status(400).json({ message: "Flyer media is required" });
    }

    const flyer = await PromotionFlyer.create({
      section: req.body.section,
      title: req.body.title || "",
      link: req.body.link || "/shop",
      image: req.file?.path || req.body.image,
      imagePublicId: req.file?.filename || "",
      mediaType: req.file ? resolveMediaType(req.file) : resolveBodyMediaType(req.body.mediaType),
      sortOrder: parseSortOrder(req.body.sortOrder),
      isActive: parseBoolean(req.body.isActive, true),
    });

    res.status(201).json({ message: "Promotion flyer created", flyer: serializePromotionFlyer(flyer) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create promotional flyer" });
  }
};

export const updatePromotionFlyer = async (req, res) => {
  try {
    const flyer = await PromotionFlyer.findById(req.params.id);
    if (!flyer) {
      return res.status(404).json({ message: "Promotion flyer not found" });
    }

    if (req.body.section !== undefined) flyer.section = req.body.section;
    if (req.body.title !== undefined) flyer.title = req.body.title;
    if (req.body.link !== undefined) flyer.link = req.body.link || "/shop";
    if (req.body.sortOrder !== undefined) flyer.sortOrder = parseSortOrder(req.body.sortOrder);

    const parsedIsActive = parseBoolean(req.body.isActive);
    if (parsedIsActive !== undefined) {
      flyer.isActive = parsedIsActive;
    }

    if (req.file?.path) {
      if (flyer.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(flyer.imagePublicId, { resource_type: flyer.mediaType === "video" ? "video" : "image" });
        } catch (uploadError) {
          console.warn("Failed to remove old promotion flyer image", uploadError);
        }
      }

      flyer.image = req.file.path;
      flyer.imagePublicId = req.file.filename || "";
      flyer.mediaType = resolveMediaType(req.file);
    } else if (req.body.image !== undefined) {
      if (flyer.imagePublicId && req.body.image !== flyer.image) {
        try {
          await cloudinary.uploader.destroy(flyer.imagePublicId, { resource_type: flyer.mediaType === "video" ? "video" : "image" });
        } catch (uploadError) {
          console.warn("Failed to remove old promotion flyer image", uploadError);
        }
      }

      flyer.image = req.body.image || flyer.image;
      flyer.imagePublicId = "";
      if (req.body.mediaType !== undefined) {
        flyer.mediaType = resolveBodyMediaType(req.body.mediaType);
      }
    }

    await flyer.save();

    res.json({ message: "Promotion flyer updated", flyer: serializePromotionFlyer(flyer) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update promotional flyer" });
  }
};

export const deletePromotionFlyer = async (req, res) => {
  try {
    const flyer = await PromotionFlyer.findById(req.params.id);
    if (!flyer) {
      return res.status(404).json({ message: "Promotion flyer not found" });
    }

    if (flyer.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(flyer.imagePublicId, { resource_type: flyer.mediaType === "video" ? "video" : "image" });
      } catch (uploadError) {
        console.warn("Failed to remove promotion flyer image", uploadError);
      }
    }

    await PromotionFlyer.deleteOne({ _id: flyer._id });
    res.json({ message: "Promotion flyer deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to delete promotional flyer" });
  }
};