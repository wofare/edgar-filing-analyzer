import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export interface ErrorResponse {
  error: string
  code: string
  details?: any
  timestamp: string
  requestId?: string
}

export enum ErrorCode {
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // Business Logic Errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_STATE = 'INVALID_STATE',
  
  // External Service Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  EDGAR_SERVICE_ERROR = 'EDGAR_SERVICE_ERROR',
  PRICE_SERVICE_ERROR = 'PRICE_SERVICE_ERROR',
  STRIPE_ERROR = 'STRIPE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  SMS_SERVICE_ERROR = 'SMS_SERVICE_ERROR',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // System Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT'
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: any
  public readonly isOperational: boolean

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message)
    
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`
    super(message, ErrorCode.NOT_FOUND, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, ErrorCode.UNAUTHORIZED, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, ErrorCode.FORBIDDEN, 403)
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CONFLICT, 409, details)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', ErrorCode.RATE_LIMIT_EXCEEDED, 429, { retryAfter })
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      502,
      { service, originalError: originalError?.message }
    )
  }
}

export function handleError(error: unknown): { response: ErrorResponse; statusCode: number } {
  console.error('Error occurred:', error)

  const requestId = generateRequestId()
  const timestamp = new Date().toISOString()

  // Handle custom AppError instances
  if (error instanceof AppError) {
    return {
      response: {
        error: error.message,
        code: error.code,
        details: error.details,
        timestamp,
        requestId
      },
      statusCode: error.statusCode
    }
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      response: {
        error: 'Validation failed',
        code: ErrorCode.VALIDATION_ERROR,
        details: error.errors,
        timestamp,
        requestId
      },
      statusCode: 400
    }
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const { response, statusCode } = handlePrismaError(error, timestamp, requestId)
    return { response, statusCode }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      response: {
        error: 'Database validation error',
        code: ErrorCode.VALIDATION_ERROR,
        timestamp,
        requestId
      },
      statusCode: 400
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      response: {
        error: 'Database connection error',
        code: ErrorCode.CONNECTION_ERROR,
        timestamp,
        requestId
      },
      statusCode: 503
    }
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    // Check for specific error messages that indicate external service issues
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return {
        response: {
          error: 'External service unavailable',
          code: ErrorCode.EXTERNAL_SERVICE_ERROR,
          timestamp,
          requestId
        },
        statusCode: 502
      }
    }

    if (error.message.includes('timeout')) {
      return {
        response: {
          error: 'Request timeout',
          code: ErrorCode.TIMEOUT,
          timestamp,
          requestId
        },
        statusCode: 504
      }
    }
  }

  // Default internal server error
  return {
    response: {
      error: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
      timestamp,
      requestId
    },
    statusCode: 500
  }
}

function handlePrismaError(
  error: Prisma.PrismaClientKnownRequestError,
  timestamp: string,
  requestId: string
): { response: ErrorResponse; statusCode: number } {
  switch (error.code) {
    case 'P2002':
      return {
        response: {
          error: 'Resource already exists',
          code: ErrorCode.ALREADY_EXISTS,
          details: { constraint: error.meta?.target },
          timestamp,
          requestId
        },
        statusCode: 409
      }

    case 'P2025':
      return {
        response: {
          error: 'Record not found',
          code: ErrorCode.NOT_FOUND,
          timestamp,
          requestId
        },
        statusCode: 404
      }

    case 'P2003':
      return {
        response: {
          error: 'Foreign key constraint violation',
          code: ErrorCode.VALIDATION_ERROR,
          details: { field: error.meta?.field_name },
          timestamp,
          requestId
        },
        statusCode: 400
      }

    case 'P2011':
      return {
        response: {
          error: 'Null constraint violation',
          code: ErrorCode.VALIDATION_ERROR,
          details: { constraint: error.meta?.constraint },
          timestamp,
          requestId
        },
        statusCode: 400
      }

    case 'P2014':
      return {
        response: {
          error: 'Invalid relation',
          code: ErrorCode.VALIDATION_ERROR,
          details: { relation: error.meta?.relation_name },
          timestamp,
          requestId
        },
        statusCode: 400
      }

    default:
      return {
        response: {
          error: 'Database error',
          code: ErrorCode.DATABASE_ERROR,
          details: { prismaCode: error.code },
          timestamp,
          requestId
        },
        statusCode: 500
      }
  }
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// Middleware wrapper for error handling
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await handler(...args)
    } catch (error) {
      const { response, statusCode } = handleError(error)
      throw new Response(JSON.stringify(response), {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }
  }
}

// API route wrapper with error handling
export function apiHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context)
    } catch (error) {
      const { response, statusCode } = handleError(error)
      return NextResponse.json(response, { status: statusCode })
    }
  }
}

// Logger for errors (in production, send to monitoring service)
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context
  }

  console.error('Application Error:', JSON.stringify(errorInfo, null, 2))

  // In production, send to monitoring service (Sentry, DataDog, etc.)
  // Example: Sentry.captureException(error, { extra: context })
}

// Health check helper
export async function checkSystemHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: Record<string, { status: 'up' | 'down'; latency?: number; error?: string }>
}> {
  const services: Record<string, { status: 'up' | 'down'; latency?: number; error?: string }> = {}

  // Check database
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    services.database = {
      status: 'up',
      latency: Date.now() - start
    }
  } catch (error) {
    services.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }

  // Check external services (simplified)
  const externalServices = [
    { name: 'edgar', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019323000077/aapl-20230930.htm' },
    { name: 'alphavantage', url: 'https://www.alphavantage.co/' }
  ]

  for (const service of externalServices) {
    try {
      const start = Date.now()
      const response = await fetch(service.url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      
      services[service.name] = {
        status: response.ok ? 'up' : 'down',
        latency: Date.now() - start
      }
    } catch (error) {
      services[service.name] = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Determine overall status
  const downServices = Object.values(services).filter(s => s.status === 'down').length
  const totalServices = Object.keys(services).length
  
  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (downServices === 0) {
    status = 'healthy'
  } else if (downServices < totalServices / 2) {
    status = 'degraded'
  } else {
    status = 'unhealthy'
  }

  return { status, services }
}

// Import prisma for health check
import { prisma } from '@/lib/db'