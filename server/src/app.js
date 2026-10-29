// Must be the FIRST import: it loads .env and validates every variable
// before db.js, initDb.js or any route file can read process.env.
import config from "./config/env.js";

import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./config/db.js";
import { initialDatabase } from "./config/initDb.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { ApiError } from "./utils/apiError.util.js";

// routes
import authRoutes from "./routes/auth.route.js";
import categoryRoutes from "./routes/category.route.js";
import productRoutes from "./routes/product.route.js";
import cartRoutes from "./routes/cart.route.js";
import orderRoutes from "./routes/order.route.js";
import paymentRoutes from "./routes/payment.route.js";
import deliveryRoutes from "./routes/delivery.route.js";
import uploadRoutes from "./routes/upload.route.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import inventoryRoutes from "./routes/inventory.route.js";
import notificationRoutes  from "./routes/Notification.route.js";

const app = express();

app.disable("x-powered-by");

// Behind nginx / a load balancer / a platform proxy, this makes req.ip and
// req.protocol correct (rate limiting depends on it). Set the number of
// proxies in front of the app; 1 is the common case.
if (config.isProduction) {
  app.set("trust proxy", 1);
}

/* =========================================================
   Security and parsing
========================================================= */

// cross-origin is required: the dashboard (another origin) loads images
// from this API. Helmet's default would block them.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin: [config.CLIENT_URL],
    credentials: true,
  }),
);

// Stripe verifies webhook signatures against the RAW body, so this path must
// be mounted before express.json(). Change the path to match your webhook
// route, and read req.body as a Buffer in that handler.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "100kb" }));

/* =========================================================
   Health checks (before rate limiting, so monitors never get blocked)
========================================================= */

app.get("/", (req, res) => {
  res.send("Api is working");
});

// Liveness: the process is up.
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Readiness: the database answers.
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

/* =========================================================
   Uploaded files (one mount; filenames are random UUIDs, so they
   never change and are safe to cache for a long time)
========================================================= */

const uploadsDirectory = fileURLToPath(new URL("../uploads/", import.meta.url));

app.use(
  "/uploads",
  express.static(uploadsDirectory, {
    dotfiles: "deny",
    index: false,
    maxAge: "365d",
    immutable: true,
  }),
);

/* =========================================================
   Rate limiting
========================================================= */

const limiterOptions = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
};

// express-rate-limit v7+ uses `limit` (v6 used `max`).
const apiLimiter = rateLimit({ ...limiterOptions, limit: 300 });
const authLimiter = rateLimit({ ...limiterOptions, limit: 20 });

app.use("/api", apiLimiter);

/* =========================================================
   Routes
========================================================= */

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/shipping-addresses", deliveryRoutes); // alias of the delivery routes
app.use("/api/upload", uploadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/notifications", notificationRoutes)

app.use((req, res, next) => {
  next(new ApiError(404, "Route not found"));
});

app.use(errorHandler);

/* =========================================================
   Start and stop
========================================================= */

let server;

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);

  // Hard stop if connections refuse to drain.
  setTimeout(() => process.exit(1), 10_000).unref();

  if (!server) {
    process.exit(0);
  }

  server.close(async () => {
    try {
      await pool.end();
    } catch (error) {
      console.error("Closing the database pool failed:", error);
    } finally {
      process.exit(0);
    }
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

const startServer = async () => {
  // Fail fast if the database is unreachable, before touching any tables.
  await pool.query("SELECT 1");
  console.log("Database connected");

  // Prefer numbered migration files over creating tables at startup.
  await initialDatabase();

  server = app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT} (${config.NODE_ENV})`);
  });

  server.on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
