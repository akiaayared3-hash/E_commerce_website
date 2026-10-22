import { pool } from "../config/db.js";

export const insertMany = async (product_id, urls, db = pool) => {
  if (!urls.length) return;

  const values = urls.map((url, index) => [product_id, url, index === 0]);

  await db.query(
    `INSERT INTO product_img (product_id, url, is_primary) VALUES ?`,
    [values],
  );
};

export const listByProduct = async (product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, product_id, url, is_primary, created_at
     FROM product_img
     WHERE product_id = ?
     ORDER BY is_primary DESC, id ASC`,
    [product_id],
  );
  return rows;
};

export const findByIdAndProduct = async (id, product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, product_id, url, is_primary
     FROM product_img
     WHERE id = ? AND product_id = ?`,
    [id, product_id],
  );
  return rows[0] ?? null;
};

export const setPrimary = async (id, product_id, db = pool) => {
  await db.query(
    `UPDATE product_img SET is_primary = false WHERE product_id = ?`,
    [product_id],
  );

  const [result] = await db.query(
    `UPDATE product_img SET is_primary = true WHERE id = ? AND product_id = ?`,
    [id, product_id],
  );
  return result.affectedRows > 0;
};

export const remove = async (id, product_id, db = pool) => {
  const [result] = await db.query(
    `DELETE FROM product_img WHERE id = ? AND product_id = ?`,
    [id, product_id],
  );
  return result.affectedRows > 0;
};

export const removeAllByProduct = async (product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT url FROM product_img WHERE product_id = ?`,
    [product_id],
  );

  await db.query(`DELETE FROM product_img WHERE product_id = ?`, [product_id]);

  return rows.map((r) => r.url);
};
