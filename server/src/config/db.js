import mysql2 from "mysql2/promise";
import config from "./env.js";

const ssl =
  config.isProduction || config.DB_SSL === "true"
    ? {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      }
    : undefined;

export const pool = mysql2.createPool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 60000,
  queueLimit: 0,

  ...(ssl ? { ssl } : {}),
});
