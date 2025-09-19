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
    log.error('[sendError] Attempted to send error after headers sent');
    return res;
  }

  log.error(`${status} - ${prefix} ${message}`);

  return res.status(status).json({ error: message });
};
