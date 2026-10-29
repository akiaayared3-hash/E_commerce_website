import bcrypt from "bcrypt";
import * as userModel from "../models/user.model.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * Get current logged-in user profile.
 */
export const getMe = async (userId) => {
  const user = await userModel.findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

/**
 * Update profile (name, phone).
 */
export const updateMe = async (userId, payload) => {
  const { first_name, last_name, phone_number } = payload;

  const updated = await userModel.updateUser(userId, {
    first_name,
    last_name,
    phone_number,
  });

  if (!updated) {
    throw new ApiError(400, "Nothing to update");
  }

  return getMe(userId);
};

/**
 * Change password while logged in.
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

  const user = await userModel.findUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // The safe-by-default ID lookup omits password_hash.
  // Fetch the login record by email to verify the current password.
  const userWithPassword = await userModel.findUserByEmail(user.email);

  if (!userWithPassword?.password_hash) {
    throw new ApiError(500, "Unable to verify the current password");
  }

  const isMatch = await bcrypt.compare(
    currentPassword,
    userWithPassword.password_hash,
  );

  if (!isMatch) {
    throw new ApiError(401, "Current password is incorrect");
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await userModel.updatePassword(userId, hash);

  return true;
};

/**
 * Admin user listing is not supported by the provided user.model.js yet.
 */
export const listUsers = async () => {
  throw new ApiError(501, "User listing is not implemented in the user model");
};

/**
 * Admin status updates are not supported by the provided user.model.js yet.
 */
export const setUserStatus = async () => {
  throw new ApiError(
    501,
    "User status management is not implemented in the user model",
  );
};
