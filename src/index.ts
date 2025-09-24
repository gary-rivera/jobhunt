import 'dotenv/config';
import app from './app';
import prisma from './lib/prisma';
import { log as logUtil } from './utils/logger';

declare global {
  var log: typeof logUtil;
}
global.log = logUtil;

const PORT = process.env.PORT || 3000;

log.info('Starting server...');

const server = app.listen(PORT, async () => {
  log.info(`Server running on: http://localhost:${PORT}`);
  await testDatabaseConnection();
});

async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    log.success('Database connected successfully on startup.\n');
  } catch (err) {
    log.error('Failed to connect to database on startup.', err);
  }
}

// NOTE: only here because my local pg connection pools were persisting after closing.
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
  log.info(`Starting graceful shutdown on received signal: ${signal}`);

  server.close(async () => {
    log.info('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
}
