import { Prisma } from '@prisma/client';
import { AppError, InternalError, NotFoundError, ValidationError, ConflictError } from './index';

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

      case 'P2002': // Unique constraint violation
        return new ConflictError('Record already exists');
      case 'P2003': // Foreign key constraint violation
        return new ValidationError('Invalid reference - related record not found');
      case 'P2004': // Constraint failed on database
        return new ValidationError('Data violates database constraints');
      case 'P2025':
        return new NotFoundError('Record not found');

      // Data Issues
      case 'P2005': // Invalid value for field type
      case 'P2006': // Provided value invalid for field type
      case 'P2007': // Data validation error
        return new ValidationError('Invalid data provided');

      // Query Issues
      case 'P2010': // Raw query failed
      case 'P2012': // Missing required value
      case 'P2013': // Missing required argument
      case 'P2014': // Required relation missing
        return new ValidationError(`Query error: ${error.message}`);

      // Table/Column Issues (should be rare in production)
      case 'P2021': // Table does not exist
      case 'P2022': // Column does not exist
        return new InternalError('Database schema error', 'validation', 500);

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
