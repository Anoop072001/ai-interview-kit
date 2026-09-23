import { createApp } from "./app.js";
import { connectDb } from "./db/connection.js";
import { config } from "./config/env.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(config.PORT, () => {
    console.log(`API listening on :${config.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
