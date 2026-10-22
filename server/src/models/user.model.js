import { pool } from "../config/db.js";

// Safe columns for normal responses
const SAFE_COLUMNS = `
  id, first_name, last_name, email, phone_number, role, is_active, is_verified, created_at
`;

// find user by id (no password hash)
export const findUserById = async (id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
};

// find user by email (includes password_hash – only for login)
export const findUserByEmail = async (email, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE email = ?`,
    [email],
  );
  return rows[0] ?? null;
};

// used by register
export const createUser = async (
  { first_name, last_name, email, password_hash, phone_number },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, phone_number)
     VALUES (?, ?, ?, ?, ?)`,
    [first_name, last_name, email, password_hash, phone_number],
  );
  return result.insertId;
};

// update profile (only the fields that are actually sent)
export const updateUser = async (id, data, db = pool) => {
  const fields = [];
  const values = [];

  if (data.first_name !== undefined) {
    fields.push("first_name = ?");
    values.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    fields.push("last_name = ?");
    values.push(data.last_name);
  }
  if (data.phone_number !== undefined) {
    fields.push("phone_number = ?");
    values.push(data.phone_number);
  }

  if (fields.length === 0) return false;

  values.push(id);

  const [result] = await db.query(
    `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = ?`,
    values,
  );
  return result.affectedRows > 0;
};

// update password
export const updatePassword = async (id, password_hash, db = pool) => {
  const [result] = await db.query(
    `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
    [password_hash, id],
  );
  return result.affectedRows > 0;
};
