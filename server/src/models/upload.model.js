// models/upload.model.js
import { pool } from "../config/db.js";

export const VIEW_TYPES = [
  "front",
  "back",
  "side",
  "left",
  "right",
  "top",
  "bottom",
  "detail",
  "model",
  "lifestyle",
];

const COLUMNS = `
  id,
  product_id,
  url,
  view_type,
  color,
  alt,
  is_primary,
  sort_order,
  created_at,
  updated_at
`;

/* =========================================================
   Reads
========================================================= */

export const listByProduct = async (product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNS}
       FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC`,
    [product_id],
  );
  return rows;
};

export const listByProductIds = async (ids, db = pool) => {
  if (!ids?.length) return [];

  const [rows] = await db.query(
    `SELECT ${COLUMNS}
       FROM product_images
      WHERE product_id IN (?)
      ORDER BY product_id ASC, sort_order ASC, id ASC`,
    [ids],
  );
  return rows;
};

export const findByIdAndProduct = async (id, product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT ${COLUMNS}
       FROM product_images
      WHERE id = ? AND product_id = ?
      LIMIT 1`,
    [id, product_id],
  );
  return rows[0] ?? null;
};

/* =========================================================
   Writes
========================================================= */

export const saveView = async (
  {
    product_id,
    view_type,
    url,
    color = null,
    alt = null,
    is_primary = false,
    sort_order = 0,
  },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO product_images
      (product_id, view_type, url, color, alt, is_primary, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [product_id, view_type, url, color, alt, is_primary ? 1 : 0, sort_order],
  );

  return { insertId: result.insertId };
};

export const updateMeta = async (id, productId, fields, db = pool) => {
  const [result] = await db.query(
    `UPDATE product_images
        SET view_type = ?,
            color = ?,
            alt = ?,
            is_primary = ?,
            sort_order = ?
      WHERE id = ? AND product_id = ?`,
    [
      fields.view_type,
      fields.color ?? null,
      fields.alt ?? null,
      fields.is_primary ? 1 : 0,
      fields.sort_order ?? 0,
      id,
      productId,
    ],
  );

  return { affected: result.affectedRows };
};

export const removeById = async (id, productId, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, url
       FROM product_images
      WHERE id = ? AND product_id = ?
      LIMIT 1`,
    [id, productId],
  );

  const row = rows[0];
  if (!row) return null;

  await db.query(`DELETE FROM product_images WHERE id = ?`, [id]);
  return { url: row.url };
};

export const remove = async (id, product_id, db = pool) => {
  const [result] = await db.query(
    `DELETE FROM product_images
      WHERE id = ? AND product_id = ?`,
    [id, product_id],
  );
  return result.affectedRows > 0;
};

export const removeAllByProduct = async (product_id, db = pool) => {
  const [rows] = await db.query(
    `SELECT url FROM product_images WHERE product_id = ?`,
    [product_id],
  );

  await db.query(`DELETE FROM product_images WHERE product_id = ?`, [
    product_id,
  ]);

  return rows.map((r) => r.url);
};

/** Legacy helper: multiple URLs as detail/front */
export const insertMany = async (product_id, urls, db = pool) => {
  if (!urls?.length) return;

  for (let index = 0; index < urls.length; index++) {
    await saveView(
      {
        product_id,
        view_type: index === 0 ? "front" : "detail",
        url: urls[index],
        is_primary: index === 0,
        sort_order: index,
      },
      db,
    );
  }
};

export const setPrimary = async (id, product_id, db = pool) => {
  const existing = await findByIdAndProduct(id, product_id, db);
  if (!existing) return false;

  await db.query(
    `UPDATE product_images
        SET is_primary = FALSE
      WHERE product_id = ? AND is_primary = TRUE`,
    [product_id],
  );

  const [result] = await db.query(
    `UPDATE product_images
        SET view_type = 'front',
            is_primary = TRUE,
            sort_order = 0
      WHERE id = ? AND product_id = ?`,
    [id, product_id],
  );

  return result.affectedRows > 0;
};
