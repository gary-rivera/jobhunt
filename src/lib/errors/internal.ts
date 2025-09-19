import { AppError } from './index';

export class InternalError extends AppError {
  public readonly statusCode: number;

  constructor(
    message: string,
    public readonly type: 'validation' | 'not_found' | 'conflict' | 'unauthorized' | 'forbidden',
    statusCode = 400,
  ) {
    super(message);

    this.statusCode = statusCode;
  }
}

export class ValidationError extends InternalError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message, 'validation');
  }
}

export class NotFoundError extends InternalError {
  constructor(
    message: string = 'Resource not found',
    public readonly resourceType?: string,
  ) {
    super(message, 'not_found', 404);
  }
}

export class ConflictError extends InternalError {
  constructor(message: string = 'Conflict occurred') {
    super(message, 'conflict', 409);
  }
}

export class UnauthorizedError extends InternalError {
  constructor(message: string = 'Invalid authentication credentials') {
    super(message, 'unauthorized', 401);
  }
}

export class ForbiddenError extends InternalError {
  constructor(message: string = 'Forbidden') {
    super(message, 'forbidden', 403);
  }
}
