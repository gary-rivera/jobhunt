import { AppError } from './base';
import { ValidationError } from './internal';

export class OllamaError extends AppError {
  public readonly statusCode: number;

  constructor(
    message: string,
    readonly type: 'unknown' | 'connection' | 'timeout' | 'model' | 'rate_limit',
    statusCode: number = 400,
  ) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class OllamaConnectionError extends OllamaError {
  constructor(message: string = 'AI service temporarily unavailable') {
    super(message, 'connection', 503);
  }
}

export class OllamaTimeoutError extends OllamaError {
  constructor(message: string = 'AI service request timed out') {
    super(message, 'timeout', 408);
  }
}

export class OllamaModelError extends OllamaError {
  constructor(message: string = 'AI model processing error') {
    super(message, 'model', 422);
  }
}

export class OllamaRateLimitError extends OllamaError {
  constructor(message: string = 'AI service rate limit exceeded') {
    super(message, 'rate_limit', 429);
  }
}

export const handleOllamaError = (error: unknown): AppError => {
  if (error instanceof Error && error.name === 'AbortError') {
    return new OllamaTimeoutError();
  }

  if (error instanceof Response) {
    switch (error.status) {
      case 400:
        return new ValidationError('Invalid request to AI service');
      case 404:
        return new OllamaModelError('AI model not found or unavailable');
      case 408:
        return new OllamaTimeoutError();
      case 500:
      case 502:
      case 503:
        return new OllamaConnectionError();
      default:
        return new OllamaConnectionError('AI service error');
    }
  }

  // Return original error if we can't convert it
  return new OllamaError(error instanceof Error ? error.message : String(error), 'unknown', 500);
};
