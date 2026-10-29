// controllers/notification.controller.js
import * as service from "../services/Nitification.service.js";

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const getNotifications = async (req, res) => {
  try {
    const { notifications, unreadCount } = await service.listNotifications(
      req.query.limit,
    );
    // Polling must never be served from a cache.
    res.set("Cache-Control", "no-store");
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("getNotifications failed:", err);
    res.status(500).json({ message: "Could not load notifications." });
  }
};

export const markRead = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid notification id." });

  try {
    const found = await service.markAsRead(id);
    if (!found) {
      return res.status(404).json({ message: "Notification not found." });
    }
    res.json({ message: "Notification marked as read." });
  } catch (err) {
    console.error("markRead failed:", err);
    res.status(500).json({ message: "Could not mark notification as read." });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const updated = await service.markAllAsRead();
    res.json({ message: "All notifications marked as read.", updated });
  } catch (err) {
    console.error("markAllRead failed:", err);
    res.status(500).json({ message: "Could not mark notifications as read." });
  }
};

export const clearAll = async (req, res) => {
  try {
    const deleted = await service.clearAll();
    res.json({ message: "Notifications cleared.", deleted });
  } catch (err) {
    console.error("clearAll failed:", err);
    res.status(500).json({ message: "Could not clear notifications." });
  }
};
