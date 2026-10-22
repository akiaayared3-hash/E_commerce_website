// utils/transaction.util.js
import { pool } from "../config/db.js";

/**
 * Runs fn(conn) inside one MySQL transaction.
 * Commits on success, rolls back on any error, always releases the connection.
 * Use this in order.service.js and payment.service.js instead of
 * local copies or the non-existent pool.transaction().
 */
export const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
