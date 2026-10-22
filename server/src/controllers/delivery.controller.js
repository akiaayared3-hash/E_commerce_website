import * as deliveryService from "../services/delivery.service.js";

export const create = async (req, res, next) => {
  try {
    const address = await deliveryService.createAddress(req.user.id, req.body);
    res.status(201).json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const addresses = await deliveryService.getUserAddresses(req.user.id);
    res.json({ success: true, data: addresses });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const address = await deliveryService.getAddress(
      req.params.id,
      req.user.id,
    );
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const address = await deliveryService.updateAddress(
      req.params.id,
      req.user.id,
      req.body,
    );
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deliveryService.deleteAddress(req.params.id, req.user.id);
    res.json({ success: true, message: "Address deleted" });
  } catch (err) {
    next(err);
  }
};

export const setDefault = async (req, res, next) => {
  try {
    const address = await deliveryService.setDefaultAddress(
      req.params.id,
      req.user.id,
    );
    res.json({ success: true, data: address });
  } catch (err) {
    next(err);
  }
};
