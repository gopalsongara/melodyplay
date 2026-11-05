import mongoose from "mongoose";

export let isMongoConnected = false;

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(
        "[mongodb] MONGODB_URI missing — library/favorites disabled. Music discovery still works.",
      );
      return;
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    isMongoConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    isMongoConnected = false;
    console.error(`[mongodb] Connection failed: ${error.message}`);
    console.warn(
      "[mongodb] Continuing without database. External music discovery remains available.",
    );
  }
};
