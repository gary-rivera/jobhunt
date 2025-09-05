import { Response } from 'express';
import { Prisma, ShortenedUrl } from '@prisma/client';

type ErrorResponse = {
	error: string;
	details?: string;
	resource?: ShortenedUrl;
};

export const sendError = (
	res: Response,
	status: number,
	message: string,
	details?: string,
	resource?: ShortenedUrl
): Response<ErrorResponse> => {
	console.error(`[sendError] Error ${status}: ${message}`);

	return res.status(status).json({
		error: message,
		...(details && { details }),
		...(resource && { resource }),
	});
};

export const sendValidationError = (
	res: Response,
	message: string,
	details?: string
) => sendError(res, 400, message, details);

export const sendNotFoundError = (res: Response, resource: string) =>
	sendError(res, 404, `${resource} not found`);

export const sendConflictError = (
	res: Response,
	message: string,
	resource?: ShortenedUrl
) => sendError(res, 409, message, undefined, resource);

export const sendUnauthorizedError = (
	res: Response,
	message = 'Invalid authentication credentials'
) => sendError(res, 401, message);

export const sendForbiddenError = (res: Response, message = 'Forbidden') =>
	sendError(res, 403, message);

export const sendInternalServerError = (
	res: Response,
	message = 'Internal server error'
) => sendError(res, 500, message);

export const handlePrismaError = (
	error: unknown,
	res: Response
): Response | void => {
	console.error('Database error:', error);

	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		switch (error.code) {
			case 'P2002':
				return sendConflictError(res, 'Record already exists');
			case 'P2025':
				return sendNotFoundError(res, 'Record');
			case 'P2003':
				return sendValidationError(res, 'Invalid reference');
			case 'P1001':
				return sendError(res, 503, 'Database unavailable');
			case 'P1008':
				return sendError(res, 408, 'Database timeout');
			default:
				return sendInternalServerError(res, 'Database error');
		}
	}

	if (error instanceof Prisma.PrismaClientValidationError) {
		return sendValidationError(res, 'Invalid data provided');
	}

	if (error instanceof Prisma.PrismaClientInitializationError) {
		return sendError(res, 503, 'Database connection failed');
	}

	return sendInternalServerError(res, 'An unexpected error occurred');
};
