import { Prisma } from '@prisma/client';
import { AppError } from './base';

export class PrismaError extends AppError {
  public readonly statusCode: number;

  constructor(
    message: string,
    readonly type: 'unknown' | 'connection' | 'timeout',
    statusCode: number,
  ) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class PrismaConnectionError extends PrismaError {
  constructor(message: string = 'Database connection failed') {
    super(message, 'connection', 503);
  }
}

export class PrismaTimeoutError extends PrismaError {
  constructor(message: string = 'Database operation timed out') {
    super(message, 'timeout', 408);
  }
}
export const convertPrismaError = (error: unknown): PrismaError => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P1001': // Can't reach database server
      case 'P1002': // Database server timeout
        return new PrismaConnectionError();
      case 'P1008': // Operations timed out
        return new PrismaTimeoutError();
      case 'P2024': // Timed out fetching a new connection
        return new PrismaTimeoutError('Database connection timeout');
      default:
        return new PrismaConnectionError('Database error');
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new PrismaConnectionError('Database not initialized');
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new PrismaConnectionError('Unknown database error');
  }

  return new PrismaError(error instanceof Error ? error.message : String(error), 'unknown', 500);
};
