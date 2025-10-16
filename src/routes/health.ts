import express from 'express';
import prisma from '../lib/prisma';
import { checkOllamaConnection } from '../services/ollama';
import { HealthCheckError } from '../lib/errors';

const healthRouter = express.Router();

healthRouter.get('/', async (req, res) => {
  log.info('📝 Health Check');
  try {
    const databaseOk = (await prisma.$queryRaw`SELECT 1` as unknown[]).length > 0
    const ollamaOk = await checkOllamaConnection()

    if (!databaseOk || !ollamaOk) {
      throw new HealthCheckError('Health check found connection errors', !databaseOk, !ollamaOk)
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      port: process.env.PORT || 3000,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: (err as Error).message || 'Unknown error',
      ...(err instanceof HealthCheckError && {
        databaseFailed: err.databaseFailed,
        llmFailed: err.llmFailed,
      })
    });
  }
});

export { healthRouter };
