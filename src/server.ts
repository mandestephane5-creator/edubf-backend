import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/db";
import { startCompositionReminderScheduler } from "./scheduler/compositionReminder";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🚀 EduBF API démarrée sur http://localhost:${env.port} (env: ${env.nodeEnv})`);
  startCompositionReminderScheduler();
});

async function shutdown(signal: string) {
  console.log(`\n${signal} reçu, arrêt propre du serveur EduBF...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
