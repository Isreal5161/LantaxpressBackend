import Admin from "../models/Admin.js";
import User from "../models/User.js";

const MAX_NOTIFICATIONS = 50;

const buildNotificationPayload = ({ type, message, meta = {} }) => ({
  type,
  message,
  meta,
  read: false,
  createdAt: new Date(),
});

const buildPushUpdate = (notification) => ({
  $push: {
    notifications: {
      $each: [buildNotificationPayload(notification)],
      $position: 0,
      $slice: MAX_NOTIFICATIONS,
    },
  },
});

const dedupeIds = (ids = []) => Array.from(new Set(ids.filter(Boolean).map((value) => value.toString())));

export const notifyUser = async (userId, notification) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, buildPushUpdate(notification));
};

export const notifyUsers = async (userIds, notification) => {
  const ids = dedupeIds(userIds);
  if (!ids.length) return;
  await User.updateMany({ _id: { $in: ids } }, buildPushUpdate(notification));
};

export const notifyAdmins = async (notification) => {
  await Admin.updateMany({}, buildPushUpdate(notification));
};

export const getSortedNotifications = (notifications = []) => {
  return [...notifications].sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
};

export const markNotificationRead = async (Model, ownerId, notificationId) => {
  const owner = await Model.findById(ownerId);
  if (!owner) {
    return { status: 404, body: { message: "Owner not found" } };
  }

  const notification = owner.notifications.id(notificationId)
    || owner.notifications.find((item) => item._id && item._id.toString() === notificationId);

  if (!notification) {
    return { status: 404, body: { message: "Notification not found" } };
  }

  notification.read = true;
  await owner.save();

  return { status: 200, body: { message: "Marked read" } };
};

export const markAllNotificationsRead = async (Model, ownerId) => {
  const owner = await Model.findById(ownerId);
  if (!owner) {
    return { status: 404, body: { message: "Owner not found" } };
  }

  (owner.notifications || []).forEach((notification) => {
    notification.read = true;
  });

  await owner.save();

  return { status: 200, body: { message: "All notifications marked as read" } };
};
