import { pool } from "../config/db.js";

const ADDRESS_COLUMNS = `
  id, user_id, full_name, phone, region, city, sub_city, 
  woreda, street, landmark, is_default, created_at, updated_at
`;

// ---------- Create ----------
export const createAddress = async (
  {
    user_id,
    full_name,
    phone,
    region,
    city,
    sub_city = null,
    woreda = null,
    street = null,
    landmark = null,
    is_default = false,
  },
  db = pool,
) => {
  // If this is set as default, unset other defaults first
  if (is_default) {
    await db.query(
      `UPDATE shipping_addresses SET is_default = false WHERE user_id = ?`,
      [user_id],
    );
  }

  const [result] = await db.query(
    `INSERT INTO shipping_addresses 
      (user_id, full_name, phone, region, city, sub_city, woreda, street, landmark, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user_id,
      full_name,
      phone,
      region,
      city,
      sub_city,
      woreda,
      street,
      landmark,
      is_default,
    ],
  );
  return result.insertId;
};

// ---------- Read ----------
export const findById = async (id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS} FROM shipping_addresses WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
};

export const findByIdAndUser = async (id, user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS} 
     FROM shipping_addresses 
     WHERE id = ? AND user_id = ?`,
    [id, user_id],
  );
  return rows[0] ?? null;
};

export const listByUser = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM shipping_addresses
     WHERE user_id = ?
     ORDER BY is_default DESC, created_at DESC`,
    [user_id],
  );
  return rows;
};

export const findDefaultByUser = async (user_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${ADDRESS_COLUMNS}
     FROM shipping_addresses
     WHERE user_id = ? AND is_default = true
     LIMIT 1`,
    [user_id],
  );
  return rows[0] ?? null;
};

// ---------- Update ----------
export const updateAddress = async (id, user_id, data, db = pool) => {
  const fields = [];
  const values = [];

  const allowed = [
    "full_name",
    "phone",
    "region",
    "city",
    "sub_city",
    "woreda",
    "street",
    "landmark",
    "is_default",
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return false;

  // Handle default flag
  if (data.is_default === true) {
    await db.query(
      `UPDATE shipping_addresses SET is_default = false WHERE user_id = ? AND id != ?`,
      [user_id, id],
    );
  }

  values.push(id, user_id);

  const [result] = await db.query(
    `UPDATE shipping_addresses
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    values,
  );
  return result.affectedRows > 0;
};

// ---------- Delete ----------
export const deleteAddress = async (id, user_id, db = pool) => {
  const [result] = await db.query(
    `DELETE FROM shipping_addresses WHERE id = ? AND user_id = ?`,
    [id, user_id],
  );
  return result.affectedRows > 0;
};

// ---------- Set as default ----------
export const setDefault = async (id, user_id, db = pool) => {
  await db.query(
    `UPDATE shipping_addresses SET is_default = false WHERE user_id = ?`,
    [user_id],
  );

  const [result] = await db.query(
    `UPDATE shipping_addresses 
     SET is_default = true, updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [id, user_id],
  );
  return result.affectedRows > 0;
};
