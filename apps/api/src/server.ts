// db/connection.js must be imported first: it applies a DNS-resolver fix
// (see the comment there) that has to run before anything else — including
// app.js, which pulls in connect-mongo's session store, and that connects
// to MongoDB eagerly at import time.
import { connectDb } from "./db/connection.js";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { recoverOrphanedGenerations } from "./kits/generationRunner.js";

async function main() {
  await connectDb();
  const recovered = await recoverOrphanedGenerations();
  if (recovered > 0) {
    console.log(`Marked ${recovered} orphaned generation(s) as failed after restart`);
  }
  const app = createApp();
  app.listen(config.PORT, () => {
    console.log(`API listening on :${config.PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
