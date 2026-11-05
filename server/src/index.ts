import { app } from "@/app.js";
import { env } from "@/config/env.js";
import { prisma } from "@/config/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`TM EMS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
