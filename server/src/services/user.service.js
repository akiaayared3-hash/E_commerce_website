import bcrypt from "bcrypt";
import * as userModel from "../models/user.model.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * Get current logged-in user profile
 */
export const getMe = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return user;
};

/**
 * Update profile (name, phone)
 */
export const updateMe = async (userId, payload) => {
  const { first_name, last_name, phone_number } = payload;

  if (phone_number) {
    const existing = await userModel.findByPhone(phone_number);
    if (existing && existing.id !== userId) {
      throw new ApiError(409, "Phone number already in use");
    }
  }

  const updated = await userModel.updateProfile(userId, {
    first_name,
    last_name,
    phone_number,
  });

  if (!updated) throw new ApiError(400, "Nothing to update");

  return userModel.findById(userId);
};

/**
 * Change password (while logged in)
 */
export const changePassword = async (
  userId,
  { currentPassword, newPassword },
) => {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters");
  }

  const user = await userModel.findByEmail(
    (await userModel.findById(userId)).email,
  );

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await userModel.updatePassword(userId, hash);

  return true;
};

/**
 * Admin: list users
 */
export const listUsers = async ({ role, limit, offset }) => {
  const [items, total] = await Promise.all([
    userModel.listUsers({ role, limit, offset }),
    userModel.countUsers({ role }),
  ]);
  return { items, total, limit, offset };
};

/**
 * Admin: activate / deactivate user
 */
export const setUserStatus = async (targetUserId, is_active) => {
  const user = await userModel.findById(targetUserId);
  if (!user) throw new ApiError(404, "User not found");

  await userModel.setActiveStatus(targetUserId, is_active);
  return userModel.findById(targetUserId);
};
