import LogisticsRequest from "../models/LogisticsRequest.js";
import { notifyAdmins, notifyUser } from "../utils/notifications.js";
import { getPlatformFeeSettings, serializePublicStorefrontSettings } from "../utils/platformFees.js";

const LOGISTICS_STAGES = [
  "Awaiting Dispatch",
  "Approved",
  "Pickup Scheduled",
  "Picked Up",
  "In Transit",
  "Arrived at Nearest Hub",
  "Out for Delivery",
  "Delivered",
  "Completed",
  "Declined",
  "Cancelled",
];

const buildRequestNumber = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LGS-${stamp}-${random}`;
};

const buildTrackingId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `LTX-${stamp}-${random}`;
};

const normalizeLocation = (location = {}) => {
  const state = String(location?.state || "").trim();
  const lga = String(location?.lga || "").trim();
  const street = String(location?.street || "").trim();
  const formattedAddress = String(location?.formattedAddress || [street, lga, state, "Nigeria"].filter(Boolean).join(", ")).trim();

  return {
    state,
    lga,
    street,
    formattedAddress,
  };
};

const resolveLocationPayload = (location, fallbackAddress) => {
  const normalizedLocation = normalizeLocation(location);
  const formattedAddress = normalizedLocation.formattedAddress || String(fallbackAddress || "").trim();

  return {
    location: {
      ...normalizedLocation,
      formattedAddress,
    },
    address: formattedAddress,
  };
};

const toStageObject = (stageMap) => {
  if (!stageMap) return {};
  if (stageMap instanceof Map) {
    return Object.fromEntries(stageMap.entries());
  }
  return stageMap;
};

const serializeLogisticsRequest = (request) => ({
  type: "logistics",
  recordId: request._id,
  id: request.trackingId,
  requestNumber: request.requestNumber,
  trackingId: request.trackingId,
  buyerId: request.buyer?._id || request.buyer,
  userName: request.contact?.name || request.buyer?.name || "Customer",
  buyer: request.contact?.name || request.buyer?.name || "Customer",
  contact: request.contact?.email || request.buyer?.email || "",
  userEmail: request.contact?.email || request.buyer?.email || "",
  phone: request.contact?.phone || "",
  productName: request.serviceType || "Logistics delivery",
  description: request.packageDescription || "",
  image: request.image || "/lantaexpressimage1.jpg",
  amount: request.amount || 0,
  totalAmount: request.amount || 0,
  shippingAmount: 0,
  currency: request.currency || "NGN",
  paymentMethod: request.paymentMethod || "card",
  status: request.status,
  stageTimestamps: toStageObject(request.stageTimestamps),
  createdAt: request.createdAt,
  received: request.received || false,
  receivedAt: request.receivedAt || null,
  serviceType: request.serviceType || "",
  urgency: request.urgency || "",
  pickupLocation: normalizeLocation(request.pickupLocation),
  deliveryLocation: normalizeLocation(request.deliveryLocation),
  pickup: request.pickupAddress || "",
  delivery: request.deliveryAddress || "",
  distanceMeters: request.distanceMeters || 0,
  distanceText: request.distanceText || "",
  durationText: request.durationText || "",
  adminNotes: request.adminNotes || "",
});

const roundCurrency = (value) => Math.max(Math.ceil(Number(value) || 0), 0);

const formatDistanceText = (distanceMeters) => {
  const kilometers = distanceMeters / 1000;
  if (kilometers >= 1) {
    return `${kilometers.toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
};

const formatDurationText = (durationMinutes) => {
  const wholeMinutes = Math.max(Math.round(durationMinutes), 1);
  if (wholeMinutes < 60) {
    return `${wholeMinutes} mins`;
  }

  const hours = Math.floor(wholeMinutes / 60);
  const minutes = wholeMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} mins` : `${hours} hr`;
};

const computeLogisticsQuote = ({ distanceMeters, settings, calculator }) => {
  const storefrontSettings = serializePublicStorefrontSettings(settings);
  const rateUnit = storefrontSettings.logisticsRateUnit === "meter" ? "meter" : "kilometer";
  const rateValue = Number(storefrontSettings.logisticsRateValue) || 0;
  const baseFee = Number(storefrontSettings.logisticsBaseFee) || 0;
  const minimumFee = Number(storefrontSettings.logisticsMinimumFee) || 0;
  const distanceUnits = rateUnit === "meter" ? distanceMeters : distanceMeters / 1000;
  const rawAmount = baseFee + (distanceUnits * rateValue);
  const amount = roundCurrency(Math.max(rawAmount, minimumFee));

  return {
    amount,
    currency: "NGN",
    distanceMeters,
    distanceText: formatDistanceText(distanceMeters),
    pricingSnapshot: {
      rateUnit,
      rateValue,
      baseFee,
      minimumFee,
      calculator,
    },
    supportPhone: storefrontSettings.logisticsSupportPhone || "",
    supportEmail: storefrontSettings.logisticsSupportEmail || "",
  };
};

const requestGoogleDistance = async (pickupAddress, deliveryAddress) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key is not configured");
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", pickupAddress);
  url.searchParams.set("destinations", deliveryAddress);
  url.searchParams.set("units", "metric");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Maps request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const row = payload?.rows?.[0]?.elements?.[0];
  if (!row || row.status !== "OK") {
    throw new Error(payload?.error_message || row?.status || "Unable to calculate route distance");
  }

  return {
    distanceMeters: Number(row.distance?.value) || 0,
    distanceText: String(row.distance?.text || ""),
    durationText: String(row.duration?.text || ""),
    calculator: "google-maps",
  };
};

const requestNominatimGeocode = async (address) => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "LantaXpress Logistics Quote Service",
    },
  });

  if (!response.ok) {
    throw new Error(`Fallback geocoding failed with status ${response.status}`);
  }

  const payload = await response.json();
  const result = payload?.[0];
  if (!result) {
    throw new Error("Address could not be resolved");
  }

  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
  };
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateHaversineDistance = (from, to) => {
  const earthRadiusMeters = 6371000;
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const requestFallbackDistance = async (pickupAddress, deliveryAddress) => {
  const [pickup, delivery] = await Promise.all([
    requestNominatimGeocode(pickupAddress),
    requestNominatimGeocode(deliveryAddress),
  ]);

  const straightLineMeters = calculateHaversineDistance(pickup, delivery);
  const adjustedRouteMeters = Math.max(straightLineMeters * 1.18, 250);
  const averageMetersPerMinute = 450;

  return {
    distanceMeters: adjustedRouteMeters,
    distanceText: formatDistanceText(adjustedRouteMeters),
    durationText: formatDurationText(adjustedRouteMeters / averageMetersPerMinute),
    calculator: "fallback-estimate",
  };
};

const calculateDistance = async (pickupAddress, deliveryAddress) => {
  try {
    return await requestGoogleDistance(pickupAddress, deliveryAddress);
  } catch {
    return requestFallbackDistance(pickupAddress, deliveryAddress);
  }
};

const isRequestOwnedByUser = (request, user) => {
  if (!request || !user) return false;

  const ownerId = request.buyer?._id?.toString?.() || request.buyer?.toString?.() || "";
  const currentUserId = user._id?.toString?.() || "";
  if (ownerId && currentUserId && ownerId === currentUserId) {
    return true;
  }

  const requestEmail = (request.contact?.email || request.buyer?.email || "").trim().toLowerCase();
  const currentUserEmail = (user.email || "").trim().toLowerCase();
  return Boolean(requestEmail && currentUserEmail && requestEmail === currentUserEmail);
};

export const quoteLogistics = async (req, res) => {
  try {
    const { pickupAddress, deliveryAddress, pickupLocation, deliveryLocation } = req.body || {};
    const resolvedPickup = resolveLocationPayload(pickupLocation, pickupAddress);
    const resolvedDelivery = resolveLocationPayload(deliveryLocation, deliveryAddress);

    if (!resolvedPickup.address || !resolvedDelivery.address) {
      return res.status(400).json({ message: "Pickup and delivery addresses are required" });
    }

    const settings = await getPlatformFeeSettings();
    const distance = await calculateDistance(resolvedPickup.address, resolvedDelivery.address);
    const quote = computeLogisticsQuote({
      distanceMeters: distance.distanceMeters,
      settings,
      calculator: distance.calculator,
    });

    res.json({
      ...quote,
      distanceText: distance.distanceText || quote.distanceText,
      durationText: distance.durationText || "",
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to calculate logistics quote" });
  }
};

export const createLogisticsBooking = async (req, res) => {
  try {
    const {
      contact,
      serviceType,
      urgency,
      pickupLocation,
      deliveryLocation,
      pickupAddress,
      deliveryAddress,
      packageDescription,
      paymentMethod,
      image,
    } = req.body || {};

    if (!contact?.name || !contact?.phone) {
      return res.status(400).json({ message: "Customer name and phone are required" });
    }

    const resolvedPickup = resolveLocationPayload(pickupLocation, pickupAddress);
    const resolvedDelivery = resolveLocationPayload(deliveryLocation, deliveryAddress);

    if (!resolvedPickup.address || !resolvedDelivery.address || !packageDescription) {
      return res.status(400).json({ message: "Pickup, delivery, and package description are required" });
    }

    const settings = await getPlatformFeeSettings();
    const distance = await calculateDistance(resolvedPickup.address, resolvedDelivery.address);
    const quote = computeLogisticsQuote({
      distanceMeters: distance.distanceMeters,
      settings,
      calculator: distance.calculator,
    });

    const now = new Date();
    const booking = await LogisticsRequest.create({
      requestNumber: buildRequestNumber(),
      trackingId: buildTrackingId(),
      buyer: req.user._id,
      contact: {
        name: String(contact.name || req.user.name || "Customer").trim(),
        email: String(contact.email || req.user.email || "").trim(),
        phone: String(contact.phone || "").trim(),
      },
      serviceType: String(serviceType || "Marketplace delivery").trim(),
      urgency: String(urgency || "Standard").trim(),
      pickupLocation: resolvedPickup.location,
      deliveryLocation: resolvedDelivery.location,
      pickupAddress: resolvedPickup.address,
      deliveryAddress: resolvedDelivery.address,
      packageDescription: String(packageDescription || "").trim(),
      image: String(image || "").trim(),
      distanceMeters: quote.distanceMeters,
      distanceText: distance.distanceText || quote.distanceText,
      durationText: distance.durationText || "",
      amount: quote.amount,
      currency: quote.currency,
      paymentMethod: paymentMethod || "card",
      pricingSnapshot: quote.pricingSnapshot,
      status: "Awaiting Dispatch",
      stageTimestamps: {
        "Awaiting Dispatch": now,
      },
    });

    const hydratedBooking = await LogisticsRequest.findById(booking._id).populate("buyer", "name email");

    await Promise.allSettled([
      notifyUser(req.user._id, {
        type: "logistics:booked",
        message: `Your logistics payment was confirmed. Tracking ID: ${booking.trackingId}.`,
        meta: { logisticsId: booking._id, trackingId: booking.trackingId, status: booking.status },
      }),
      notifyAdmins({
        type: "logistics:new",
        message: `${req.user.name || req.user.email || "A customer"} paid for a logistics request worth NGN ${quote.amount.toLocaleString()}.`,
        meta: { logisticsId: booking._id, trackingId: booking.trackingId, buyerId: req.user._id },
      }),
    ]);

    res.status(201).json({
      message: "Logistics booking created successfully",
      trackingId: booking.trackingId,
      booking: serializeLogisticsRequest(hydratedBooking),
      supportPhone: quote.supportPhone,
      supportEmail: quote.supportEmail,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create logistics booking" });
  }
};

export const trackLogisticsByTrackingId = async (req, res) => {
  try {
    const booking = await LogisticsRequest.findOne({ trackingId: req.params.trackingId }).populate("buyer", "name email");
    if (!booking) {
      return res.status(404).json({ message: "Logistics booking not found" });
    }

    if (!isRequestOwnedByUser(booking, req.user) && req.userSource !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(serializeLogisticsRequest(booking));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to track logistics booking" });
  }
};

export const getAdminLogisticsRequests = async (req, res) => {
  try {
    const requests = await LogisticsRequest.find()
      .populate("buyer", "name email")
      .sort({ createdAt: -1 });

    res.json({ requests: requests.map(serializeLogisticsRequest) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load logistics requests" });
  }
};

export const updateAdminLogisticsStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body || {};
    if (!LOGISTICS_STAGES.includes(status)) {
      return res.status(400).json({ message: "Invalid logistics status" });
    }

    const booking = await LogisticsRequest.findById(req.params.id).populate("buyer", "name email");
    if (!booking) {
      return res.status(404).json({ message: "Logistics request not found" });
    }

    const timestamps = toStageObject(booking.stageTimestamps);
    timestamps[status] = new Date();

    booking.status = status;
    booking.stageTimestamps = timestamps;
    if (adminNotes !== undefined) {
      booking.adminNotes = String(adminNotes || "").trim();
    }
    if (status === "Completed") {
      booking.received = true;
      booking.receivedAt = new Date();
    }
    await booking.save();

    const statusMessages = {
      Approved: `Your logistics request ${booking.trackingId} has been approved and is ready for dispatch updates.`,
      Declined: `Your logistics request ${booking.trackingId} was declined. Please review admin notes for guidance.`,
      Cancelled: `Your logistics request ${booking.trackingId} was cancelled.`,
      Completed: `Your logistics request ${booking.trackingId} has been completed successfully.`,
    };

    await notifyUser(booking.buyer?._id || booking.buyer, {
      type: "logistics:status-updated",
      message: statusMessages[status] || `Tracking ID ${booking.trackingId} is now ${status}.`,
      meta: { logisticsId: booking._id, trackingId: booking.trackingId, status },
    });

    res.json({
      message: "Logistics status updated successfully",
      booking: serializeLogisticsRequest(booking),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update logistics status" });
  }
};