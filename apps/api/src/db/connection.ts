import mongoose from "mongoose";
import { config } from "../config/env.js";

let connected = false;

export async function connectDb(): Promise<void> {
  if (connected) return;
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI);
  connected = true;
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
