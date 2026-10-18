
import dotenv from 'dotenv';
import path from 'path';
import { success, z } from 'zod';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({path: envPath});

// define the validation schema

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  // database seatings

  DB_HOST: z.string().min(1, "127.0.0.1"),
  DB_PORT: z.coerce.number().default(8889),
  DB_USER: z.string().min(1, "root"),
  DB_PASSWORD: z.string().optional().default("XLNx2rl7z]Nx0vxd"),
  DB_NAME: z.string().min(1, "E_commerce_api"),

  // authentication and security

  JWT_SECRET: z.string().min(32, "JWT_SECRET is minimum 32 long characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // payment integration

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // cors configuration

  CLIENT_URL: z.string().url().default(`https://localhost:3000`),
});

// validate process.env gaines the schema 

const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
 console.log("invalid inevaironmental detected")
 console.error(parseResult.error.format())
 process.exit(1)

}

export const config = parseResult.data;
export default config;