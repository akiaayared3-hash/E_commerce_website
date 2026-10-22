import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { findUserById } from "../models/user.model.js";

export const protect = asyncHandler(async (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT secret is not configured");
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "Please login to access this resource");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new ApiError(401, "Please login to access this resource");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Token expired, please login again");
    }
    throw new ApiError(401, "Invalid token");
  }

  if (!decoded?.id) {
    throw new ApiError(401, "Invalid token payload");
  }

  const user = await findUserById(decoded.id);

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  if (!user.is_active) {
    throw new ApiError(403, "Your account has been deactivated");
  }

  req.user = user;
  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action"),
      );
    }
    next();
  };
};
