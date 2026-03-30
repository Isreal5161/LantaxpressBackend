import PlatformFeeSettings from "../models/PlatformFeeSettings.js";

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
};

export const serializePlatformFeeSettings = (settings) => ({
  productChargePercent: clampPercent(settings?.productChargePercent),
  withdrawalChargePercent: clampPercent(settings?.withdrawalChargePercent),
});

export const getPlatformFeeSettings = async () => {
  let settings = await PlatformFeeSettings.findOne().sort({ createdAt: 1 });
  if (!settings) {
    settings = await PlatformFeeSettings.create({});
  }
  return settings;
};

export const updatePlatformFeeSettings = async ({ productChargePercent, withdrawalChargePercent }) => {
  const settings = await getPlatformFeeSettings();
  settings.productChargePercent = clampPercent(productChargePercent);
  settings.withdrawalChargePercent = clampPercent(withdrawalChargePercent);
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
