import { Response } from 'express';

export type ErrorResponse = {
  error: string;
  details?: string;
};

export const sendError = (
  res: Response,
  status: number,
  message: string,
  prefix = '[sendError]',
): Response<ErrorResponse> => {
  if (res.headersSent) {
    log.error('Attempted to send error after headers sent');
    return res;
  }

  log.error(`${status} - ${prefix} ${message}`);

  return res.status(status).json({ error: message });
};

export const sendValidationError = (
  res: Response,
  message: string = 'Bad request',
  prefix: string = '[sendValidationError]',
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
