import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./config/db.js";
import { initialDatabase } from "./config/initDb.js";
import config from "./config/env.js";
import chapaRoutes from "./routes/chapaRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { ApiError } from "./utils/apiError.util.js";
// import routes
import authRoutes from './routes/auth.route.js';
import categoryRoutes from './routes/category.route.js'
import  productRoutes from "./routes/product.route.js";

// start server
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.SITE_URL || true }));
app.use(helmet());



// Chapa payment routes
app.use("/api/chapa", chapaRoutes);


// test local host is serve the request
app.get("/", (req, resp) => {
  resp.send("Api is working");
});

//mount routes
app.use("/api/auth", authRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/products", productRoutes);

app.use((req, res, next) => {
  console.log("NO ROUTE:", req.method, req.originalUrl);
  next(new ApiError(404, "Route not found"));
});

app.use(errorHandler);

// add port listener
const startServer = async () => {
  try {
    // initial table
    await initialDatabase();

    // Verify database pool connectivity
    const connection = await pool.getConnection();
    console.log("✅ Connect");
    connection.release();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`server is listen at http://localhost:${port}`);
    });
  } catch (error) {
    throw error;
  }
};
startServer();
