import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.util.js";
import { findUserById } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";

// authentication: who is this user?
export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new ApiError(401, "Please login first");
  }
 
  const token = authHeader.split(" ")[1];
  if (!token) {
    throw new ApiError(401, "Please login first");
  }
  // A bad or expired token makes jwt.verify throw. Turn that into a 401,
  // otherwise your error handler may report it as a 500.
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token, please login again");
  }
  const user = await findUserById(decoded.id);
  if (!user || !user.is_active) {
    throw new ApiError(401, "Please login first");
  }

  req.user = user;
  next();
});

// authorization: is this user allowed? Always use it after protect.
export const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied");
    }
    next();
  };
