import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  EntityNotFoundError,
  MissingTenantHeaderError,
  TenantMismatchError,
  TenantNotRegisteredError,
  UnauthenticatedError,
} from './domain-errors.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      response.status(this.domainErrorStatus(exception)).json({
        error: { code: exception.code, message: exception.message },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);

      response.status(exception.getStatus()).json({
        error: {
          code: 'HTTP_ERROR',
          message: Array.isArray(message) ? 'Validation failed' : message,
          details: Array.isArray(message) ? message : undefined,
        },
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }

  private domainErrorStatus(exception: DomainError): number {
    if (exception instanceof EntityNotFoundError) {
      return HttpStatus.NOT_FOUND;
    }

    if (exception instanceof UnauthenticatedError) {
      return HttpStatus.UNAUTHORIZED;
    }

    if (
      exception instanceof TenantMismatchError ||
      exception instanceof TenantNotRegisteredError
    ) {
      return HttpStatus.FORBIDDEN;
    }

    if (exception instanceof MissingTenantHeaderError) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}
