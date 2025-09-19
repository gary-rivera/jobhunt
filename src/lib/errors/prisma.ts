import { Prisma } from '@prisma/client';
import { AppError, InternalError } from './index';

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
export const convertPrismaError = (error: unknown): AppError => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P1001': // Can't reach database server
      case 'P1002': // Database server timeout
        return new PrismaConnectionError();
      case 'P1008': // Operations timed out
        return new PrismaTimeoutError();
      case 'P2024': // Timed out fetching a new connection
        return new PrismaTimeoutError('Database connection timeout');
      // Schema/query errors should be internal errors
      case 'P2010': // Raw query failed
        return new InternalError(`Database query validation error`, 'validation', 500);

      default:
        // Don't assume connection error for unknown codes
        return new InternalError(`Database error (${error.code}): ${error.message}`, 'validation', 500);
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
