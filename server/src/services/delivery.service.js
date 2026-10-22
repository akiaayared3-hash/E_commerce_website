import * as deliveryModel from "../models/delivery.model.js";
import { ApiError } from "../utils/apiError.util.js";

/**
 * Create a new shipping address for the logged-in user
 */
export const createAddress = async (user_id, payload) => {
  const {
    full_name,
    phone,
    region,
    city,
    sub_city,
    woreda,
    street,
    landmark,
    is_default = false,
  } = payload;

  if (!full_name || !phone || !region || !city) {
    throw new ApiError(400, "full_name, phone, region and city are required");
  }

  const id = await deliveryModel.createAddress({
    user_id,
    full_name,
    phone,
    region,
    city,
    sub_city,
    woreda,
    street,
    landmark,
    is_default,
  });

  return deliveryModel.findById(id);
};

/**
 * Get all addresses of a user
 */
export const getUserAddresses = async (user_id) => {
  return deliveryModel.listByUser(user_id);
};

/**
 * Get one address (must belong to the user)
 */
export const getAddress = async (id, user_id) => {
  const address = await deliveryModel.findByIdAndUser(id, user_id);
  if (!address) throw new ApiError(404, "Address not found");
  return address;
};

/**
 * Update an address
 */
export const updateAddress = async (id, user_id, payload) => {
  const existing = await deliveryModel.findByIdAndUser(id, user_id);
  if (!existing) throw new ApiError(404, "Address not found");

  const updated = await deliveryModel.updateAddress(id, user_id, payload);
  if (!updated) throw new ApiError(400, "Nothing to update");

  return deliveryModel.findById(id);
};

/**
 * Delete an address
 */
export const deleteAddress = async (id, user_id) => {
  const deleted = await deliveryModel.deleteAddress(id, user_id);
  if (!deleted) throw new ApiError(404, "Address not found");
  return true;
};

/**
 * Set an address as default
 */
export const setDefaultAddress = async (id, user_id) => {
  const existing = await deliveryModel.findByIdAndUser(id, user_id);
  if (!existing) throw new ApiError(404, "Address not found");

  await deliveryModel.setDefault(id, user_id);
  return deliveryModel.findById(id);
};

/**
 * Get the default address of a user (useful when placing an order)
 */
export const getDefaultAddress = async (user_id) => {
  return deliveryModel.findDefaultByUser(user_id);
};
