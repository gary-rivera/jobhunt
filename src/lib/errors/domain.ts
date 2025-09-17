import { ApiError } from './base';

export class ValidationError extends ApiError {
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  readonly statusCode = 404;

  constructor(
    message: string,
    public readonly resourceType?: string,
  ) {
    super(message);
  }
}

export class ConflictError extends ApiError {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends ApiError {
  readonly statusCode = 401;

  constructor(message: string = 'Invalid authentication credentials') {
    super(message);
  }
}

export class ForbiddenError extends ApiError {
  readonly statusCode = 403;

  constructor(message: string = 'Forbidden') {
    super(message);
  }
}
