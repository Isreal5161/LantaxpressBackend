import Order from "../models/Order.js";
import User from "../models/User.js";
import SellerWithdrawal from "../models/SellerWithdrawal.js";
import { notifyAdmins, notifyUser } from "../utils/notifications.js";

const ACTIVE_ORDER_STATUSES = new Set([
  "Pending",
  "Approved",
  "Processing",
  "Shipped",
  "In Transit",
  "Out for Delivery",
  "Delivered",
]);

const serializeWithdrawal = (withdrawal) => ({
  id: withdrawal._id,
  sellerId: withdrawal.seller?._id || withdrawal.seller,
  sellerName: withdrawal.seller?.brandName || withdrawal.seller?.name || "Seller",
  sellerEmail: withdrawal.seller?.email || "",
  amount: withdrawal.amount || 0,
  currency: withdrawal.currency || "NGN",
  method: withdrawal.method || "Bank Transfer",
  accountName: withdrawal.accountName || "",
  accountNumber: withdrawal.accountNumber || "",
  bankName: withdrawal.bankName || "",
  status: withdrawal.status || "Pending",
  requestedAt: withdrawal.requestedAt || withdrawal.createdAt,
  processedAt: withdrawal.processedAt || null,
  adminNotes: withdrawal.adminNotes || "",
  createdAt: withdrawal.createdAt,
  updatedAt: withdrawal.updatedAt,
});

const resolveOrderAmount = (order) => Number(order.amount) || 0;

const isSettledOrder = (order) => order.status === "Completed" || Boolean(order.received);

const isPendingOrder = (order) => !isSettledOrder(order) && ACTIVE_ORDER_STATUSES.has(order.status);

const buildIncomeTrend = (orders) => {
  const monthly = new Map();

  orders.filter(isSettledOrder).forEach((order) => {
    const sourceDate = order.receivedAt || order.updatedAt || order.createdAt;
    const date = new Date(sourceDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(monthKey, (monthly.get(monthKey) || 0) + resolveOrderAmount(order));
  });

  const sortedKeys = Array.from(monthly.keys()).sort();
  const recentKeys = sortedKeys.slice(-6);

  return recentKeys.map((monthKey) => {
    const [year, month] = monthKey.split("-");
    const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-NG", {
      month: "short",
      year: "numeric",
    });

    return {
      month: label,
      income: monthly.get(monthKey) || 0,
    };
  });
};

const buildSellerFinanceSummary = async (sellerId) => {
  const [orders, withdrawals] = await Promise.all([
    Order.find({ seller: sellerId }).sort({ createdAt: -1 }),
    SellerWithdrawal.find({ seller: sellerId }).sort({ createdAt: -1 }),
  ]);

  const totalRevenue = orders.filter(isSettledOrder).reduce((sum, order) => sum + resolveOrderAmount(order), 0);
  const pendingBalance = orders.filter(isPendingOrder).reduce((sum, order) => sum + resolveOrderAmount(order), 0);
  const completedWithdrawals = withdrawals
    .filter((withdrawal) => withdrawal.status === "Approved")
    .reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0);
  const pendingWithdrawalRequests = withdrawals
    .filter((withdrawal) => withdrawal.status === "Pending")
    .reduce((sum, withdrawal) => sum + (Number(withdrawal.amount) || 0), 0);

  const withdrawableBalance = Math.max(totalRevenue - completedWithdrawals - pendingWithdrawalRequests, 0);

  return {
    totalRevenue,
    pendingBalance,
    withdrawableBalance,
    completedWithdrawals,
    pendingWithdrawalRequests,
    totalOrders: orders.length,
    settledOrders: orders.filter(isSettledOrder).length,
    pendingOrders: orders.filter(isPendingOrder).length,
    incomeTrend: buildIncomeTrend(orders),
    recentSettlements: orders
      .filter(isSettledOrder)
      .slice(0, 5)
      .map((order) => ({
        id: order.orderNumber,
        amount: resolveOrderAmount(order),
        status: order.status,
        receivedAt: order.receivedAt || order.updatedAt || order.createdAt,
      })),
    recentWithdrawals: withdrawals.slice(0, 5).map(serializeWithdrawal),
  };
};

export const getSellerFinanceSummary = async (req, res) => {
  try {
    const summary = await buildSellerFinanceSummary(req.user._id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load finance summary" });
  }
};

export const getSellerWithdrawals = async (req, res) => {
  try {
    const withdrawals = await SellerWithdrawal.find({ seller: req.user._id }).sort({ createdAt: -1 });
    res.json(withdrawals.map(serializeWithdrawal));
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load withdrawal requests" });
  }
};

export const createSellerWithdrawal = async (req, res) => {
  try {
    const { amount, method, bankName, accountName, accountNumber } = req.body || {};
    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ message: "Enter a valid withdrawal amount" });
    }

    if (method === "Bank Transfer" && (!bankName || !accountName || !accountNumber)) {
      return res.status(400).json({ message: "Bank name, account name, and account number are required" });
    }

    const summary = await buildSellerFinanceSummary(req.user._id);
    if (parsedAmount > summary.withdrawableBalance) {
      return res.status(400).json({ message: "Withdrawal amount exceeds withdrawable balance" });
    }

    const withdrawal = await SellerWithdrawal.create({
      seller: req.user._id,
      amount: parsedAmount,
      currency: "NGN",
      method: method || "Bank Transfer",
      bankName: bankName || "",
      accountName: accountName || "",
      accountNumber: accountNumber || "",
    });

    const saved = await SellerWithdrawal.findById(withdrawal._id).populate("seller", "name email brandName");

    await Promise.all([
      notifyUser(req.user._id, {
        type: "withdrawal:submitted",
        message: `Your withdrawal request for NGN ${parsedAmount.toLocaleString()} has been submitted.`,
        meta: { withdrawalId: withdrawal._id, amount: parsedAmount, status: "Pending" },
      }),
      notifyAdmins({
        type: "withdrawal:requested",
        message: `${req.user.brandName || req.user.name || "A seller"} requested a withdrawal of NGN ${parsedAmount.toLocaleString()}.`,
        meta: { withdrawalId: withdrawal._id, sellerId: req.user._id, amount: parsedAmount },
      }),
    ]);

    res.status(201).json({
      message: "Withdrawal request submitted successfully",
      withdrawal: serializeWithdrawal(saved),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to create withdrawal request" });
  }
};

export const getAdminSellerPayments = async (req, res) => {
  try {
    const sellers = await User.find({ role: "seller" }).select("name email brandName state country").sort({ createdAt: -1 });

    const summaries = await Promise.all(
      sellers.map(async (seller) => {
        const summary = await buildSellerFinanceSummary(seller._id);
        return {
          sellerId: seller._id,
          sellerName: seller.brandName || seller.name || "Seller",
          contactName: seller.name || seller.brandName || "Seller",
          email: seller.email || "",
          state: seller.state || "",
          country: seller.country || "Nigeria",
          ...summary,
        };
      })
    );

    const pendingWithdrawals = await SellerWithdrawal.find({ status: "Pending" })
      .populate("seller", "name email brandName")
      .sort({ createdAt: -1 });

    res.json({
      sellers: summaries,
      pendingWithdrawals: pendingWithdrawals.map(serializeWithdrawal),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to load seller payments" });
  }
};

export const updateWithdrawalStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body || {};
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid withdrawal status" });
    }

    const withdrawal = await SellerWithdrawal.findById(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }

    if (withdrawal.status !== "Pending") {
      return res.status(400).json({ message: "Only pending withdrawal requests can be updated" });
    }

    if (status === "Approved") {
      const summary = await buildSellerFinanceSummary(withdrawal.seller);
      if (withdrawal.amount > summary.withdrawableBalance + withdrawal.amount) {
        return res.status(400).json({ message: "Withdrawal amount exceeds the seller's available balance" });
      }
    }

    withdrawal.status = status;
    withdrawal.adminNotes = adminNotes || "";
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    const saved = await SellerWithdrawal.findById(withdrawal._id).populate("seller", "name email brandName");

    await notifyUser(withdrawal.seller, {
      type: `withdrawal:${status.toLowerCase()}`,
      message: status === "Approved"
        ? `Your withdrawal of NGN ${Number(withdrawal.amount || 0).toLocaleString()} was approved.`
        : `Your withdrawal of NGN ${Number(withdrawal.amount || 0).toLocaleString()} was rejected.`,
      meta: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status,
        adminNotes: withdrawal.adminNotes || "",
      },
    });

    res.json({
      message: `Withdrawal ${status.toLowerCase()} successfully`,
      withdrawal: serializeWithdrawal(saved),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Failed to update withdrawal status" });
  }
};