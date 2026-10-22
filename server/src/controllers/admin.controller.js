import * as userModel from "../models/user.model.js";
import * as paymentModel from "../models/payment.model.js";
// import other models as needed

export const listUsers = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const role = req.query.role || null;

    const users = await userModel.listUsers({ role, limit, offset });
    const total = await userModel.countUsers({ role });

    res.json({
      success: true,
      data: { items: users, total, limit, offset },
    });
  } catch (err) {
    next(err);
  }
};

export const setUserStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const updated = await userModel.setActiveStatus(req.params.id, is_active);

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = await userModel.findUserById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const listPayments = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const status = req.query.status || null;

    const payments = await paymentModel.findAll({ status, limit, offset });
    const total = await paymentModel.countAll({ status });

    res.json({
      success: true,
      data: { items: payments, total, limit, offset },
    });
  } catch (err) {
    next(err);
  }
};
