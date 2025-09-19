import { Response } from 'express';
import { Prisma } from '@prisma/client';

export type ErrorResponse = {
  error: string;
  details?: string;
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  prefix = '[sendError]',
  // details: string | null = null
): Response<ErrorResponse> => {
  log.error(`${prefix} ${message}`);

  return res.status(status).json({
    error: message,
    // ...(details && { details }),
  });
};

export const sendBadRequestError = (
  res: Response,
  message: string = 'Bad request',
  prefix: string = '[sendBadRequestError]',
) => sendError(res, 400, message, prefix);

export const sendNotFoundError = (
  res: Response,
  message: string = 'Not found',
  prefix: string = '[sendNotFoundError]',
) => sendError(res, 404, message, prefix);

export const sendConflictError = (
  res: Response,
  message: string = 'Conflict',
  prefix: string = '[sendConflictError]',
) => sendError(res, 409, message, prefix);

export const sendUnauthorizedError = (
  res: Response,
  message = 'Invalid authentication credentials',
  prefix: string = '[sendUnauthorizedError]',
) => sendError(res, 401, message, prefix);

export const sendForbiddenError = (res: Response, message = 'Forbidden', prefix: string = '[sendForbiddenError]') =>
  sendError(res, 403, message, prefix);

export const sendInternalServerError = (
  res: Response,
  message = 'Internal server error',
  prefix: string = '[sendInternalServerError]',
) => sendError(res, 500, message, prefix);

export const handlePrismaError = (error: unknown, res: Response): Response | void => {
  const prefix = '[handlePrismaError]';
  log.error(`${prefix} Database error:`, error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return sendConflictError(res, 'Record already exists', prefix);
      case 'P2004':
        return sendBadRequestError(res, 'Constraint violation', prefix);
      case 'P2006':
        return sendBadRequestError(res, 'Invalid query value', prefix);
      case 'P2011':
        return sendBadRequestError(res, 'Null constraint violation', prefix);
      case 'P2025':
        return sendNotFoundError(res, 'Record not found', prefix);
      case 'P2003':
        return sendBadRequestError(res, 'Invalid reference', prefix);
      case 'P1001':
        return sendInternalServerError(res, 'Database unavailable', prefix);
      case 'P1008':
        return sendError(res, 408, 'Database timeout', prefix);
      default:
        return sendError(res, 500, 'Database error', prefix);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return sendBadRequestError(res, 'Invalid data provided', prefix);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return sendError(res, 503, 'Database connection failed', prefix);
  }

  return sendInternalServerError(res, 'An unexpected error occurred', prefix);
};
