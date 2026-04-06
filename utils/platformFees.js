import PlatformFeeSettings from "../models/PlatformFeeSettings.js";

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
};

const clampMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(numeric, 0);
};

const clampDays = (value, fallback, max = 30) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(Math.round(numeric), 0), max);
};

const serializeOptionalDays = (value, { min = 0, max = 30 } = {}) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.min(Math.max(Math.round(numeric), min), max);
};

export const serializePlatformFeeSettings = (settings) => ({
  productChargePercent: clampPercent(settings?.productChargePercent),
  withdrawalChargePercent: clampPercent(settings?.withdrawalChargePercent),
  deliveryMinDays: serializeOptionalDays(settings?.deliveryMinDays, { min: 1, max: 30 }),
  deliveryMaxDays: serializeOptionalDays(settings?.deliveryMaxDays, { min: 1, max: 30 }),
  returnWindowDays: serializeOptionalDays(settings?.returnWindowDays, { min: 0, max: 60 }),
  shippingPolicyTitle: String(settings?.shippingPolicyTitle || "Shipping Policy"),
  shippingPolicyContent: String(settings?.shippingPolicyContent || ""),
  returnPolicyTitle: String(settings?.returnPolicyTitle || "Return Policy"),
  returnPolicyContent: String(settings?.returnPolicyContent || ""),
  pickupStationPolicyContent: String(settings?.pickupStationPolicyContent || ""),
  homeDeliveryPolicyContent: String(settings?.homeDeliveryPolicyContent || ""),
});

export const serializePublicStorefrontSettings = (settings) => {
  const serialized = serializePlatformFeeSettings(settings);
  const hasDeliveryMinDays = Number.isFinite(Number(serialized.deliveryMinDays));
  const hasDeliveryMaxDays = Number.isFinite(Number(serialized.deliveryMaxDays));
  const deliveryMinDays = hasDeliveryMinDays ? Math.max(Number(serialized.deliveryMinDays), 1) : null;
  const deliveryMaxDays = hasDeliveryMaxDays
    ? Math.max(Number(serialized.deliveryMaxDays), deliveryMinDays || 1)
    : null;

  return {
    deliveryMinDays,
    deliveryMaxDays,
    returnWindowDays: serialized.returnWindowDays,
    shippingPolicyTitle: serialized.shippingPolicyTitle,
    shippingPolicyContent: serialized.shippingPolicyContent,
    returnPolicyTitle: serialized.returnPolicyTitle,
    returnPolicyContent: serialized.returnPolicyContent,
    pickupStationPolicyContent: serialized.pickupStationPolicyContent,
    homeDeliveryPolicyContent: serialized.homeDeliveryPolicyContent,
  };
};

export const getPlatformFeeSettings = async ({ createIfMissing = false } = {}) => {
  let settings = await PlatformFeeSettings.findOne().sort({ createdAt: 1 });
  if (!settings && createIfMissing) {
    settings = await PlatformFeeSettings.create({});
  }
  return settings;
};

export const updatePlatformFeeSettings = async ({
  productChargePercent,
  withdrawalChargePercent,
  deliveryMinDays,
  deliveryMaxDays,
  returnWindowDays,
  shippingPolicyTitle,
  shippingPolicyContent,
  returnPolicyTitle,
  returnPolicyContent,
  pickupStationPolicyContent,
  homeDeliveryPolicyContent,
}) => {
  const settings = await getPlatformFeeSettings({ createIfMissing: true });
  settings.productChargePercent = clampPercent(productChargePercent);
  settings.withdrawalChargePercent = clampPercent(withdrawalChargePercent);

  const normalizedMinDays = serializeOptionalDays(deliveryMinDays, { min: 1, max: 30 });
  const normalizedMaxDays = serializeOptionalDays(deliveryMaxDays, { min: 1, max: 30 });

  settings.deliveryMinDays = normalizedMinDays;
  settings.deliveryMaxDays = normalizedMaxDays !== null
    ? Math.max(normalizedMaxDays, normalizedMinDays || 1)
    : null;
  settings.returnWindowDays = serializeOptionalDays(returnWindowDays, { min: 0, max: 60 });
  if (shippingPolicyTitle !== undefined) settings.shippingPolicyTitle = String(shippingPolicyTitle || "Shipping Policy").trim();
  if (shippingPolicyContent !== undefined) settings.shippingPolicyContent = String(shippingPolicyContent || "").trim();
  if (returnPolicyTitle !== undefined) settings.returnPolicyTitle = String(returnPolicyTitle || "Return Policy").trim();
  if (returnPolicyContent !== undefined) settings.returnPolicyContent = String(returnPolicyContent || "").trim();
  if (pickupStationPolicyContent !== undefined) settings.pickupStationPolicyContent = String(pickupStationPolicyContent || "").trim();
  if (homeDeliveryPolicyContent !== undefined) settings.homeDeliveryPolicyContent = String(homeDeliveryPolicyContent || "").trim();
  await settings.save();
  return settings;
};

export const calculateProductCharge = (amount, percent) => {
  const grossAmount = Number(amount) || 0;
  const chargePercent = clampPercent(percent);
  const chargeAmount = (grossAmount * chargePercent) / 100;
  const sellerNetAmount = Math.max(grossAmount - chargeAmount, 0);

  return {
    grossAmount,
    chargePercent,
    chargeAmount,
    sellerNetAmount,
  };
};

export const calculateWithdrawalCharge = (amount, percent) => {
  const requestedAmount = Number(amount) || 0;
  const chargePercent = clampPercent(percent);
  const chargeAmount = (requestedAmount * chargePercent) / 100;
  const payoutAmount = Math.max(requestedAmount - chargeAmount, 0);

  return {
    requestedAmount,
    chargePercent,
    chargeAmount,
    payoutAmount,
  };
};

export const resolveOrderNetAmount = (order, fallbackPercent = 0) => {
  const grossAmount = Number(order?.amount) || 0;
  const storedNetAmount = Number(order?.sellerNetAmount);
  const storedChargeAmount = Number(order?.productChargeAmount);
  const storedChargePercent = Number(order?.productChargePercent);

  const hasStoredFeeSnapshot =
    Number.isFinite(storedChargeAmount) && storedChargeAmount > 0 ||
    Number.isFinite(storedChargePercent) && storedChargePercent > 0;

  const hasMeaningfulStoredNetAmount =
    Number.isFinite(storedNetAmount) &&
    (storedNetAmount > 0 || grossAmount === 0 || hasStoredFeeSnapshot);

  if (hasMeaningfulStoredNetAmount) {
    return Math.max(storedNetAmount, 0);
  }

  const orderFeePercent = Number(order?.productChargePercent);
  const resolvedPercent = Number.isFinite(orderFeePercent)
    ? clampPercent(orderFeePercent)
    : clampPercent(fallbackPercent);

  return calculateProductCharge(grossAmount, resolvedPercent).sellerNetAmount;
};
