import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/errors/base';
import { ValidationError, NotFoundError, ConflictError, UnauthorizedError, ForbiddenError } from '../lib/errors/domain';
import {
  sendError,
  sendInternalServerError,
  sendValidationError,
  sendNotFoundError,
  sendConflictError,
  sendForbiddenError,
  sendUnauthorizedError,
} from '../lib/errors/http';

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): ApiError => {
  switch (error.code) {
    case 'P2002':
      return new ConflictError('Record already exists');
    case 'P2025':
      return new NotFoundError('Record not found');
    case 'P2004':
      return new ValidationError('Database constraint violation');
    case 'P2006':
      return new ValidationError('Invalid value provided');
    case 'P2011':
      return new ValidationError('Required field is missing');
    case 'P2003':
      return new ValidationError('Invalid reference to related record');
    case 'P1001':
    case 'P1008':
      // operational but not user errors - throw as generic
      return new (class extends ApiError {
        readonly statusCode = error.code === 'P1008' ? 408 : 503;
      })(error.code === 'P1008' ? 'Database timeout' : 'Database unavailable');
    default:
      return new (class extends ApiError {
        readonly statusCode = 500;
      })('Database error');
  }
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  // Handle Prisma errors by converting to domain errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const domainError = handlePrismaError(err);
    sendError(res, domainError.statusCode, domainError.message, '[PrismaError]');
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 400, 'Invalid data provided', '[PrismaValidation]');
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    sendError(res, 503, 'Database connection failed', '[PrismaInit]');
    return;
  }

  // Map ApiError subclasses to their specific HTTP translators
  if (err instanceof ValidationError) {
    sendValidationError(res, err.message, `[${err.name}]`);
    return;
  }

  if (err instanceof NotFoundError) {
    sendNotFoundError(res, err.message, `[${err.name}]`);
    return;
  }

  if (err instanceof ConflictError) {
    sendConflictError(res, err.message, `[${err.name}]`);
    return;
  }

  if (err instanceof UnauthorizedError) {
    sendUnauthorizedError(res, err.message, `[${err.name}]`);
    return;
  }

  if (err instanceof ForbiddenError) {
    sendForbiddenError(res, err.message, `[${err.name}]`);
    return;
  }

  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, `[${err.name}]`);
    return;
  }

  log.error('Unhandled error:', err);
  sendInternalServerError(res, 'Something went wrong', '[SystemError]');
};
