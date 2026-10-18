import { pool } from "../config/db.js";

const UPDATABLE = ["parent_id", "name", "slug", "description"];

export const create = async (
  { parent_id = null, name, slug, description = null },
  db = pool,
) => {
  const [result] = await db.query(
    `INSERT INTO categories (parent_id, name, slug, description)
     VALUES (?, ?, ?, ?)`,
    [parent_id, name, slug, description],
  );
  return result.insertId;
};

export const findById = async (id, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, parent_id, name, slug, description, created_at
     FROM categories WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
};

export const findBySlug = async (slug, db = pool) => {
  const [rows] = await db.query(
    `SELECT id, parent_id, name, slug, description, created_at
     FROM categories WHERE slug = ?`,
    [slug],
  );
  return rows[0] ?? null;
};

export const findAll = async (db = pool) => {
  const [rows] = await db.query(
    `SELECT id, parent_id, name, slug, description, created_at
     FROM categories
     ORDER BY name ASC`,
  );
  return rows;
};

export const update = async (id, fields, db = pool) => {
  const keys = Object.keys(fields).filter(
    (k) => UPDATABLE.includes(k) && fields[k] !== undefined,
  );
  if (keys.length === 0) return false;

  const setClause = keys.map((k) => `${k} = ?`).join(", ");
  const [result] = await db.query(
    `UPDATE categories SET ${setClause} WHERE id = ?`,
    [...keys.map((k) => fields[k]), id],
  );
  return result.affectedRows > 0;
};

export const remove = async (id, db = pool) => {
  const [result] = await db.query(`DELETE FROM categories WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};
