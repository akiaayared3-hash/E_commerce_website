import jwt from "jsonwebtoken";
import { ApiError } from "../utils/apiError.util.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { findUserById } from "../models/user.model.js";

export const protect = asyncHandler(async (req, resp, next) => {
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new ApiError(401, "User login first")
  }
  const token = authHeader.split(" ")[1];
  if(!token) {
    throw new ApiError(401, "User login first")
  }
 const decoded = jwt.verify(token, process.env.JWT_SECRET)
 const user = await findUserById(decoded.id)
 if(!user || !user.is_active) {
    throw new ApiError(401, "User login first")
 }
 req.user = user;
 next();
})