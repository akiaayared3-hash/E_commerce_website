import { pool } from "../config/db.js";

const ADDRESS_COLUMNS = `id, user_id, full_name, phone, region, city, sub_city,
  woreda, street, landmark, is_default, created_at, updated_at`;

// Looks up by id AND owner in one query: returns null if not this user's
export const findByIdAndUser = async (address_id, user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM shipping_addresses
     WHERE id = ? AND user_id = ?`,
    [address_id, user_id],
  );
  return rows[0] ?? null;
};

export const findByUserId = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM shipping_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, id ASC`,
    [user_id],
  );
  return rows;
};

// Pass the transaction connection as `db` so the insert rolls back with checkout.
// Returns the new address id.
export const insert = async (data, db = pool) => {
  const [result] = await db.query(
    `INSERT INTO shipping_addresses
       (user_id, full_name, phone, region, city, sub_city, woreda, street, landmark, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
    [
      data.user_id,
      data.full_name,
      data.phone,
      data.region,
      data.city,
      data.sub_city ?? null,
      data.woreda ?? null,
      data.street ?? null,
      data.landmark ?? null,
    ],
  );
  return result.insertId;
};
