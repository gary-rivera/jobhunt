import express from 'express';
import prisma from '../lib/prisma';
import { checkOllamaConnection } from '../services/ollama';

const healthRouter = express.Router();

healthRouter.get('/', async (req, res) => {
  log.info('📝 Health Check');
  try {
    const prismaStatusOk = await prisma.$queryRaw`SELECT 1`;
    if (!prismaStatusOk) throw new Error('Prisma/DB connection failed');

    const ollamaStatusOk = await checkOllamaConnection();
    if (!ollamaStatusOk) throw new Error('Ollama connection failed -> missing required models');

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      port: process.env.PORT || 3000,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: (err as Error).message || 'Database connection failed',
    });
  }
});

export { healthRouter };
