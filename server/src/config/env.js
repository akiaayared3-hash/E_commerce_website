import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loads the local .env file if it exists. It never overrides variables already
// set by the host, so production platform settings always win.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Treat empty values (e.g. `STRIPE_SECRET_KEY=`) as not set.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([, value]) => value !== undefined && value !== "",
  ),
);

const url = (name) =>
  z.string().min(1, `${name} is required`).url(`${name} must be a valid URL`);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),

    // URLs
    PUBLIC_API_URL: url("PUBLIC_API_URL"),
    CLIENT_URL: url("CLIENT_URL"),

    // Database
    DB_HOST: z.string().min(1, "DB_HOST is required"),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().min(1, "DB_USER is required"),
    DB_PASSWORD: z.string().optional(),
    DB_NAME: z.string().min(1, "DB_NAME is required"),

    // Auth
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().default("7d"),

    // Payments
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    PAYMENT_RETURN_URL: z.string().optional(),
    PAYMENT_CALLBACK_URL: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const fail = (path, message) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    for (const key of ["PUBLIC_API_URL", "CLIENT_URL"]) {
      try {
        const { protocol } = new URL(value[key]);
        if (!["http:", "https:"].includes(protocol))
          fail(key, "Must use HTTP or HTTPS");
        if (value.NODE_ENV === "production" && protocol !== "https:") {
          fail(key, "Must use HTTPS in production");
        }
      } catch {
        // Invalid URLs are already reported by the field rule above.
      }
    }

    if (value.NODE_ENV === "production") {
      if (!value.DB_PASSWORD) fail("DB_PASSWORD", "Required in production");
      if (/change|example|secret|password/i.test(value.JWT_SECRET)) {
        fail("JWT_SECRET", "Looks like a placeholder, generate a random value");
      }
    }
  });

const result = envSchema.safeParse(rawEnv);

if (!result.success) {
  console.error("Invalid environment configuration:");
  for (const issue of result.error.issues) {
    // Only print the variable name and the problem, never the value.
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

const data = result.data;

export const config = Object.freeze({
  ...data,
  // Normalize to a bare origin: no path, no trailing slash.
  PUBLIC_API_URL: new URL(data.PUBLIC_API_URL).origin,
  CLIENT_URL: new URL(data.CLIENT_URL).origin,
  isProduction: data.NODE_ENV === "production",
  isDevelopment: data.NODE_ENV === "development",
  isTest: data.NODE_ENV === "test",
});

export default config;
