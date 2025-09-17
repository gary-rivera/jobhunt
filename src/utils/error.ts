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
  log.error(`${prefix} Error ${status}: ${message}`);

  return res.status(status).json({
    error: message,
    // ...(details && { details }),
  });
};

export const sendBadRequestError = (
  res: Response,
  message: string,
  prefix: string = '[sendBadRequestError]',
) => sendError(res, 400, message, prefix);

export const sendNotFoundError = (
  res: Response,
  resource: string,
  prefix: string = '[sendNotFoundError]',
) => sendError(res, 404, `${resource} not found`, prefix);

export const sendConflictError = (
  res: Response,
  message: string,
  prefix: string = '[sendConflictError]',
) => sendError(res, 409, message, prefix);

export const sendUnauthorizedError = (
  res: Response,
  message = 'Invalid authentication credentials',
  prefix: string = '[sendUnauthorizedError]',
) => sendError(res, 401, message, prefix);

export const sendForbiddenError = (
  res: Response,
  message = 'Forbidden',
  prefix: string = '[sendForbiddenError]',
) => sendError(res, 403, message, prefix);

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
        return sendConflictError(res, `${prefix} Record already exists`);
      case 'P2025':
        return sendNotFoundError(res, `${prefix} Record not found`);
      case 'P2003':
        return sendBadRequestError(res, `${prefix} Invalid reference`);
      case 'P1001':
        return sendInternalServerError(res, `${prefix} Database unavailable`);
      case 'P1008':
        return sendError(res, 408, `${prefix} Database timeout`);
      default:
        return sendError(res, 500, `${prefix} Database error`);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return sendBadRequestError(res, `${prefix} Invalid data provided`);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return sendError(res, 503, `${prefix} Database connection failed`);
  }

  return sendInternalServerError(res, `${prefix} An unexpected error occurred`);
};
