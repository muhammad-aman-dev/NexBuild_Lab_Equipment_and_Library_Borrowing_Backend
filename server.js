
import "dotenv/config";

import app from "./src/app.js";
import connectDB from "./src/config/db.js";

const PORT = process.env.PORT || 5000;

console.log("------------------------------------");
console.log("[SERVER] Starting Campus Inventory");
console.log("[SERVER] Environment:", process.env.NODE_ENV || "development");
console.log("[SERVER] Port:", PORT);
console.log("[SERVER] MongoDB URI exists:", Boolean(process.env.MONGO_URI));
console.log("------------------------------------");

const startServer = async () => {
  try {
    console.log("[DATABASE] Starting MongoDB connection...");

    await connectDB();

    console.log("[DATABASE] MongoDB connection function completed");

    const server = app.listen(PORT, () => {
      console.log("------------------------------------");
      console.log("[SERVER] Server started successfully");
      console.log(`[SERVER] Listening on port ${PORT}`);
      console.log("[SERVER] API is ready");
      console.log("------------------------------------");
    });

    server.on("error", (error) => {
      console.error("[SERVER ERROR]", error.message);
    });

    process.on("SIGTERM", () => {
      console.log("[SERVER] SIGTERM received. Closing server...");

      server.close(() => {
        console.log("[SERVER] Server closed");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("------------------------------------");
    console.error("[STARTUP ERROR] Server failed to start");
    console.error("[STARTUP ERROR] Message:", error.message);
    console.error("[STARTUP ERROR] Stack:", error.stack);
    console.error("------------------------------------");

    process.exit(1);
  }
};

startServer();
