export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract type: string;

  constructor(message: string) {
    super(message);

    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
