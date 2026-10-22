import { pool } from "../config/db.js";

const ADDRESS_COLUMNS = `id, user_id, address_line1, address_line2, city, postal, country, is_default, updated_at`;

// Looks up by id AND owner in one query: returns null if the address is not this user's
export const findByIdAndUser = async (address_id, user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS} FROM addresses WHERE id = ? AND user_id = ?`,
    [address_id, user_id],
  );
  return rows[0] ?? null;
};

export const findByUserId = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, id ASC`,
    [user_id],
  );
  return rows;
};
