import { pool } from "../config/db.js";

// find user by id (no password hash, safe for req.user)
export const findUserById = async (id) => {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, phone_number, role, is_active
     FROM users WHERE id = ?`,
    [id],
  );
  return rows[0];
};

// find user by email (includes password_hash, for login only)
export const findUserByEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT id, first_name, last_name, email, password_hash, role, is_active
     FROM users WHERE email = ?`,
    [email],
  );
  return rows[0];
};

// used by register
export const createUser = async ({
  first_name,
  last_name,
  email,
  password_hash,
  phone_number,
}) => {
  const [result] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone_number)
     VALUES (?, ?, ?, ?, ?)`,
    [first_name, last_name, email, password_hash, phone_number],
  );
  return result.insertId;
};

// update profile (safe fields only)
export const updateUser = async (
  id,
  { first_name, last_name, phone_number },
) => {
  const [result] = await pool.query(
    `UPDATE users
     SET first_name = ?, last_name = ?, phone_number = ?
     WHERE id = ?`,
    [first_name, last_name, phone_number, id],
  );
  return result.affectedRows > 0;
};

// update password
export const updatePassword = async (id, password_hash) => {
  const [result] = await pool.query(
    `UPDATE users SET password_hash = ? WHERE id = ?`,
    [password_hash, id],
  );
  return result.affectedRows > 0;
};
