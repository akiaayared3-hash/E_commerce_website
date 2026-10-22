import * as userService from "../services/user.service.js";

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.user.id, req.body);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(req.user.id, req.body);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const adminList = async (req, res, next) => {
  try {
    const data = await userService.listUsers({
      role: req.query.role,
      limit: Number(req.query.limit) || 20,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const adminSetStatus = async (req, res, next) => {
  try {
    const user = await userService.setUserStatus(
      req.params.id,
      req.body.is_active,
    );
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
