import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { InternalError, OllamaError, convertPrismaError } from '../lib/errors/index';
import { sendError } from '../lib/errors/http';

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): Response | void => {
  if (res.headersSent) {
    return next(error);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    const prismaError = convertPrismaError(error);
    return sendError(res, prismaError.statusCode, prismaError.message, `[Prisma:${prismaError.type}]`);
  }

  if (error instanceof InternalError) {
    return sendError(res, error.statusCode, error.message, `[Internal:${error.type}]`);
  }

  if (error instanceof OllamaError) {
    return sendError(res, error.statusCode, error.message, `[Ollama:${error.type}]`);
  }

  return sendError(res, 500, error instanceof Error ? error.message : String(error), '[Unknown]');
};
