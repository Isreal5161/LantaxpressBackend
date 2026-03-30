export const getSellerApprovalStatus = (user) => {
  if (!user || user.role !== "seller") {
    return null;
  }

  return user.sellerApprovalStatus || "approved";
};

export const isSellerApproved = (user) => getSellerApprovalStatus(user) === "approved";

export const getSellerApprovalMessage = (user) => {
  const status = getSellerApprovalStatus(user);

  if (status === "pending") {
    return "Your seller account is pending admin approval.";
  }

  if (status === "rejected") {
    return "Your seller account has not been approved by admin yet.";
  }

  return "Your seller account is approved.";
};