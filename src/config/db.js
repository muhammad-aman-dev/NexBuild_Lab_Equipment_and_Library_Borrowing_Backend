import mongoose from "mongoose";

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

// Safe info about the connection string (never includes the password)
export const getUriInfo = (uri) => {
  if (!uri) return { present: false };

  const trimmed = uri.trim();
  const match = trimmed.match(
    /^(mongodb(?:\+srv)?):\/\/(?:([^:@/]+):([^@]*)@)?([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/
  );

  return {
    present: true,
    length: uri.length,
    hasLeadingOrTrailingSpace: uri !== trimmed,
    startsWithQuote: /^["']/.test(uri),
    endsWithQuote: /["']$/.test(uri),
    scheme: match ? match[1] : "UNPARSEABLE",
    username: match ? match[2] || null : null,
    passwordLength: match && match[3] ? match[3].length : 0,
    host: match ? match[4] : null,
    databaseName: match ? match[5] || "(none)" : null,
    options: match ? match[6] || "(none)" : null,
    pointsToLocalhost: /127\.0\.0\.1|localhost/.test(uri),
  };
};

// Pulls the real reason out of Mongoose / MongoDB driver errors
export const describeDbError = (err) => {
  const servers = [];
  const map = err?.reason?.servers;

  if (map) {
    const entries =
      typeof map.entries === "function" ? [...map.entries()] : Object.entries(map);

    for (const [address, desc] of entries) {
      servers.push({
        address,
        type: desc?.type,
        error: desc?.error
          ? {
              name: desc.error.name,
              message: desc.error.message,
              code: desc.error.code,
              cause: desc.error.cause?.message,
            }
          : null,
      });
    }
  }

  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    codeName: err?.codeName,
    syscall: err?.syscall,
    hostname: err?.hostname,
    cause: err?.cause?.message,
    topologyType: err?.reason?.type,
    replicaSetName: err?.reason?.setName,
    servers,
    stack: err?.stack?.split("\n").slice(0, 4),
  };
};

mongoose.connection.on("error", (e) =>
  console.error("[MONGOOSE EVENT] error:", e.message)
);
mongoose.connection.on("disconnected", () =>
  console.warn("[MONGOOSE EVENT] disconnected")
);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI environment variable is missing");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    console.log("[DB] Connecting with:", JSON.stringify(getUriInfo(process.env.MONGO_URI)));

    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        bufferCommands: false,
      })
      .then((m) => {
        console.log(`[DB] MongoDB Connected: ${m.connection.host}`);
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;