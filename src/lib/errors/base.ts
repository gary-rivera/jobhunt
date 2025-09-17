export abstract class ApiError extends Error {
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
