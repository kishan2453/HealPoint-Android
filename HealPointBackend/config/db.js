import mongoose from "mongoose";
import "colors";

let cachedPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  const uri =
    process.env.MONGO_URI ||
    (process.env.MONGO_LOCAL_URI
      ? `${process.env.MONGO_LOCAL_URI}/doctorapp`
      : "mongodb://localhost:27017/doctorapp");

  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  };

  cachedPromise = mongoose
    .connect(uri, opts)
    .then(async (m) => {
      console.log("MongoDB Database Connected".bgMagenta.white);
      try {
        const usersCol = m.connection.collection("users");
        // Drop legacy non-sparse googleId_1 index if it exists
        const indexes = await usersCol.indexes().catch(() => []);
        const gIndex = indexes.find((idx) => idx.name === "googleId_1");
        if (gIndex && !gIndex.sparse) {
          console.log("Dropping non-sparse googleId_1 index to prevent duplicate empty string collision...");
          await usersCol.dropIndex("googleId_1").catch(() => {});
        }
        // Unset any empty string googleId values from legacy records
        await usersCol.updateMany({ googleId: "" }, { $unset: { googleId: "" } }).catch(() => {});
      } catch (err) {
        console.warn("Index sanitization notice:", err.message);
      }
      return m;
    })
    .catch((err) => {
      cachedPromise = null;
      console.error("MongoDB connection error:", err.message);
      throw err;
    });

  return cachedPromise;
};

export default connectDB;
