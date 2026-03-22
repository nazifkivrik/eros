/**
 * Application Error Classes
 * Custom error types for better error handling and type safety
 */

export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = "Authentication failed") {
    super(message, "AUTHENTICATION_FAILED");
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED");
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, "NOT_FOUND");
  }
}

export class BusinessLogicError extends ApplicationError {
  constructor(
    message: string,
    public readonly code: string = "BUSINESS_LOGIC_ERROR"
  ) {
    super(message, code);
  }
}

export class FileSystemError extends ApplicationError {
  constructor(message: string) {
    super(message, "FILE_SYSTEM_ERROR");
  }
}

export class ExternalServiceError extends ApplicationError {
  constructor(service: string, message: string) {
    super(
      `External service '${service}': ${message}`,
      "EXTERNAL_SERVICE_ERROR"
    );
  }
}
