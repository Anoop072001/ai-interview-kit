import dns from "node:dns";
import mongoose from "mongoose";
import { config } from "../config/env.js";

let connected = false;

// `mongodb+srv://` (Atlas) resolves a DNS SRV/TXT record before connecting.
// On some machines the OS hands Node an IPv6 link-local resolver address,
// which Node's DNS library fails to query correctly (EBADRESP) even though
// the same lookup succeeds at the OS level — a local resolver quirk, not a
// real connectivity issue. Falling back to public DNS for the SRV lookup
// sidesteps it without needing the user to change their network settings.
if (config.MONGODB_URI.startsWith("mongodb+srv://")) {
  // Replacing outright, not appending — keeping the original (broken)
  // resolver in the list at all was enough to poison the SRV lookup, even
  // with working servers listed ahead of it.
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

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
