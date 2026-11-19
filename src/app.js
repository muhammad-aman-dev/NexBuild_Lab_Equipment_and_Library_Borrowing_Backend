
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import authorizationRoutes from "./routes/authorizationRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import inventoryUnitRoutes from "./routes/inventoryUnitRoutes.js";
import borrowRequestRoutes from "./routes/borrowRequestRoutes.js";
import borrowRequestReviewRoutes from "./routes/borrowRequestReviewRoutes.js";
import loanRoutes from "./routes/loanRoutes.js";
import returnRoutes from "./routes/returnRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import staffRoutes from "./routes/staffRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import connectDB, { describeDbError, getUriInfo } from "./config/db.js";

const app = express();

// ==========================================
// 1. APPLICATION CONFIGURATION
// ==========================================

app.set("trust proxy", 1);

console.log("------------------------------------");
console.log("[APP] Campus Inventory API starting");
console.log("[APP] Environment:", process.env.NODE_ENV || "development");
console.log("[APP] Trust proxy:", app.get("trust proxy"));
console.log("[APP] Client URL configured:", Boolean(process.env.CLIENT_URL));
console.log("[APP] MongoDB URI configured:", Boolean(process.env.MONGO_URI));
console.log("------------------------------------");

// ==========================================
// 2. RATE LIMITER
// ==========================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,  

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// ==========================================
// 3. MIDDLEWARE
// ==========================================

// Request diagnostic middleware
// Keep this BEFORE the rate limiter and routes.

app.use((req, res, next) => {
  const startTime = Date.now();

  console.info("[REQUEST IN]", {
    method: req.method,
    path: req.path,
    trustProxy: app.get("trust proxy"),
    forwardedHeaderPresent: Boolean(req.headers.forwarded),
    xForwardedForPresent: Boolean(req.headers["x-forwarded-for"]),
    clientIpAvailable: Boolean(req.ip),
  });

  res.on("finish", () => {
    console.info("[REQUEST OUT]", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - startTime}ms`,
    });
  });

  next();
});

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Make sure MongoDB is connected before any route runs (needed on Vercel)
// TEMPORARY: open /api/v1/db-check in the browser to see the real DB error
app.get("/api/v1/db-check", async (req, res) => {
  try {
    const m = await connectDB();
    res.json({
      success: true,
      host: m.connection.host,
      readyState: m.connection.readyState,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      uriInfo: getUriInfo(process.env.MONGO_URI),
      error: describeDbError(err),
    });
  }
});

// Make sure MongoDB is connected before any route runs (needed on Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("[DB] Connection failed:", JSON.stringify(describeDbError(err)));
    res.status(503).json({ success: false, message: "Database unavailable" });
  }
});

// ==========================================
// 4. API ROUTES
// ==========================================

console.log("[ROUTES] Registering API routes");

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/authorization", authorizationRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/inventory-units", inventoryUnitRoutes);
app.use("/api/borrow-requests", borrowRequestRoutes);
app.use("/api/borrow-requests", borrowRequestReviewRoutes);
app.use("/api/loans", returnRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/dashboard", dashboardRoutes);

// ==========================================
// 5. HEALTH CHECK
// ==========================================

app.get("/api/v1/health", (req, res) => {
  console.log("[HEALTH] Health endpoint called");

  res.status(200).json({
    success: true,
    message: "Campus Inventory API is running",
    environment: process.env.NODE_ENV || "development",
    trustProxy: app.get("trust proxy"),
  });
});

// ==========================================
// 6. NOT FOUND HANDLER
// ==========================================

app.use((req, res) => {
  console.warn("[404] API endpoint not found:", {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// ==========================================
// 7. GLOBAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
  console.error("[API ERROR]", {
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

console.log("[APP] Express application initialized successfully");

export default app;
