import bcrypt from "bcrypt";
import { ApiError } from "../utils/apiError.util.js";
import { generateToken } from "../utils/jwt.utile.js";
import {
  findUserByEmail,
  findUserById,
  createUser,
} from "../models/user.model.js";


// register user
export const registerUser = async ({
  first_name,
  last_name,
  email,
  password,
  phone_number,
}) => {
  if (!first_name || !last_name || !email || !password || !phone_number) {
    throw new ApiError(400, "All fields are required");
  }
  // password length check
  if (password.length < 8) {
    throw new ApiError(400, "Password must be greater than 8 characters");
  }
  const cleanEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    throw new ApiError(409, "Email is already use");
  }
 const password_hash = await bcrypt.hash(password, 10);
 const id = await createUser({
    first_name,
    last_name,
    email: cleanEmail,
    password_hash,
    phone_number
 })
const user = await findUserById(id);
const token = generateToken(user)
return  { user, token }
};
// login use 

export const loginUser = async (email, password) => {
    if(!email || !password) {
        throw new ApiError(400, "Email and Password are required")
    }
    const user = await findUserByEmail(email.trim().toLowerCase());
    const valid = user && (await bcrypt.compare(password, user.password_hash));
 if (!valid) {
    throw new ApiError(403, "Invalid email or password");
 }
if (!user.is_active) throw new ApiError(400, "account is disable");

const {  password_hash, ...safeUser } = user;
const token = generateToken(safeUser);
return { user: safeUser, token };
}