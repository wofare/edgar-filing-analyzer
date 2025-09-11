import winston from 'winston'
import { monitoringService } from './sentry'

export interface LogContext {
  userId?: string
  userEmail?: string
  component?: string
  action?: string
  requestId?: string
  sessionId?: string
  metadata?: Record<string, any>
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export class Logger {
  private winstonLogger: winston.Logger
  private static instance: Logger

  constructor() {
    this.winstonLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            ...meta
          })
        })
      ),
      transports: this.createTransports()
    })
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private createTransports(): winston.transport[] {
    const transports: winston.transport[] = []

    // Console transport for development
    if (process.env.NODE_ENV === 'development') {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, component, action, ...meta }) => {
              let logMessage = `${timestamp} ${level}: ${message}`
              
              if (component || action) {
                logMessage += ` [${component || 'unknown'}${action ? `::${action}` : ''}]`
              }
              
              if (Object.keys(meta).length > 0) {
                logMessage += ` ${JSON.stringify(meta)}`
              }
              
              return logMessage
            })
          )
        })
      )
    }

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      // General log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/app.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      )

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      )
    }

    // DataDog transport if configured
    if (process.env.DATADOG_API_KEY) {
      const DatadogWinston = require('datadog-winston')
      transports.push(
        new DatadogWinston({
          apikey: process.env.DATADOG_API_KEY,
          hostname: process.env.HOSTNAME || 'unknown',
          service: process.env.SERVICE_NAME || 'whatchanged',
          ddsource: 'nodejs',
          ddtags: `env:${process.env.NODE_ENV || 'unknown'}`
        })
      )
    }

    return transports
  }

  // Core logging methods
  error(message: string, error?: Error, context?: LogContext): void {
    const logData = {
      message,
      ...context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    }

    this.winstonLogger.error(logData)

    // Also send to monitoring service
    if (error) {
      monitoringService.captureException(error, context)
    } else {
      monitoringService.captureMessage(message, 'error', context)
    }
  }

  warn(message: string, context?: LogContext): void {
    this.winstonLogger.warn({ message, ...context })
    monitoringService.captureMessage(message, 'warning', context)
  }

  info(message: string, context?: LogContext): void {
    this.winstonLogger.info({ message, ...context })
  }

  debug(message: string, context?: LogContext): void {
    this.winstonLogger.debug({ message, ...context })
  }

  // Structured logging methods
  logUserAction(
    userId: string,
    action: string,
    component: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`User action: ${action}`, {
      userId,
      action,
      component,
      metadata
    })

    monitoringService.addBreadcrumb(
      `User performed ${action}`,
      'user.action',
      { component, ...metadata }
    )
  }

  logAPIRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    error?: Error
  ): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info'
    const message = `${method} ${endpoint} ${statusCode} ${duration}ms`

    const context: LogContext = {
      component: 'API',
      action: `${method} ${endpoint}`,
      userId,
      metadata: {
        method,
        endpoint,
        statusCode,
        duration
      }
    }

    if (error) {
      this.error(message, error, context)
    } else {
      this[level](message, context)
    }
  }

  logDatabaseQuery(
    query: string,
    duration: number,
    table?: string,
    userId?: string
  ): void {
    const context: LogContext = {
      component: 'Database',
      action: 'query',
      userId,
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        duration,
        table
      }
    }

    if (duration > 1000) {
      this.warn(`Slow database query: ${duration}ms`, context)
    } else {
      this.debug(`Database query: ${duration}ms`, context)
    }
  }

  logJobExecution(
    jobType: string,
    jobId: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
    error?: Error
  ): void {
    const message = `Job ${jobType} (${jobId}) ${status}${duration ? ` in ${duration}ms` : ''}`
    
    const context: LogContext = {
      component: 'JobQueue',
      action: jobType,
      metadata: {
        jobId,
        jobType,
        status,
        duration
      }
    }

    if (error) {
      this.error(message, error, context)
    } else if (status === 'failed') {
      this.error(message, undefined, context)
    } else {
      this.info(message, context)
    }
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: LogContext
  ): void {
    const message = `Security event: ${event}`
    
    const securityContext = {
      ...context,
      component: 'Security',
      action: event,
      metadata: {
        ...context.metadata,
        severity
      }
    }

    if (severity === 'critical' || severity === 'high') {
      this.error(message, undefined, securityContext)
    } else if (severity === 'medium') {
      this.warn(message, securityContext)
    } else {
      this.info(message, securityContext)
    }
  }

  logPerformanceMetric(
    metric: string,
    value: number,
    threshold?: number,
    context?: LogContext
  ): void {
    const message = `Performance metric: ${metric} = ${value}`
    
    const perfContext: LogContext = {
      ...context,
      component: 'Performance',
      action: 'metric',
      metadata: {
        ...context?.metadata,
        metric,
        value,
        threshold
      }
    }

    if (threshold && value > threshold) {
      this.warn(`${message} (exceeds threshold of ${threshold})`, perfContext)
    } else {
      this.debug(message, perfContext)
    }

    // Record metric in monitoring service
    monitoringService.recordMetric(metric, value, {
      component: context?.component || 'unknown'
    })
  }

  logPaymentEvent(
    event: string,
    userId: string,
    amount?: number,
    currency?: string,
    paymentId?: string,
    error?: Error
  ): void {
    const message = `Payment event: ${event}`
    
    const context: LogContext = {
      userId,
      component: 'Payment',
      action: event,
      metadata: {
        amount,
        currency,
        paymentId
      }
    }

    if (error) {
      this.error(message, error, context)
    } else {
      this.info(message, context)
    }
  }

  // Utility methods
  createRequestLogger(requestId: string, userId?: string) {
    return {
      error: (message: string, error?: Error, metadata?: Record<string, any>) =>
        this.error(message, error, { requestId, userId, metadata }),
      
      warn: (message: string, metadata?: Record<string, any>) =>
        this.warn(message, { requestId, userId, metadata }),
      
      info: (message: string, metadata?: Record<string, any>) =>
        this.info(message, { requestId, userId, metadata }),
      
      debug: (message: string, metadata?: Record<string, any>) =>
        this.debug(message, { requestId, userId, metadata })
    }
  }

  // Query logs (useful for debugging and monitoring)
  async queryLogs(
    level?: LogLevel,
    component?: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 100
  ): Promise<any[]> {
    // This is a simplified implementation
    // In production, you'd query your log aggregation service
    return new Promise((resolve) => {
      const query = {
        level,
        component,
        startTime,
        endTime,
        limit
      }

      // Mock implementation - replace with actual log querying
      setTimeout(() => {
        resolve([])
      }, 100)
    })
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    details: Record<string, any>
  }> {
    try {
      // Test log writing
      const testMessage = `Health check at ${new Date().toISOString()}`
      this.debug(testMessage)

      return {
        status: 'healthy',
        details: {
          level: this.winstonLogger.level,
          transports: this.winstonLogger.transports.length
        }
      }
    } catch (error) {
      this.error('Logger health check failed', error as Error)
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message
        }
      }
    }
  }
}

// Global logger instance
export const logger = Logger.getInstance()

// Convenience exports
export const log = {
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  
  userAction: logger.logUserAction.bind(logger),
  apiRequest: logger.logAPIRequest.bind(logger),
  dbQuery: logger.logDatabaseQuery.bind(logger),
  jobExecution: logger.logJobExecution.bind(logger),
  securityEvent: logger.logSecurityEvent.bind(logger),
  performanceMetric: logger.logPerformanceMetric.bind(logger),
  paymentEvent: logger.logPaymentEvent.bind(logger),
  
  createRequestLogger: logger.createRequestLogger.bind(logger)
}

export default logger