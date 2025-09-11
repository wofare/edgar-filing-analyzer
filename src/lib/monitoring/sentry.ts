import * as Sentry from '@sentry/nextjs'
import { User } from '@prisma/client'

export interface ErrorContext {
  userId?: string
  userEmail?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

export class MonitoringService {
  private static instance: MonitoringService
  private initialized = false

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  // Initialize Sentry
  initialize(): void {
    if (this.initialized || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return
    }

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Session Replay
      replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Release tracking
      release: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      
      // Error filtering
      beforeSend(event, hint) {
        // Filter out development errors
        if (process.env.NODE_ENV === 'development') {
          console.error('Sentry Event:', event, hint)
        }

        // Filter out known noise
        if (event.exception) {
          const error = hint.originalException
          if (error instanceof Error) {
            // Filter out network errors that aren't actionable
            if (error.message.includes('NetworkError') || 
                error.message.includes('fetch')) {
              return null
            }
            
            // Filter out extension errors
            if (error.stack?.includes('extension://')) {
              return null
            }
          }
        }

        return event
      },

      // Integrations
      integrations: [
        new Sentry.BrowserTracing({
          // Set tracing origins
          tracePropagationTargets: [
            'localhost',
            process.env.NEXT_PUBLIC_BASE_URL || 'https://whatchanged.app',
            /^\//
          ],
          routingInstrumentation: Sentry.nextRouterInstrumentation(
            // Import next/router dynamically to avoid SSR issues
            typeof window !== 'undefined' ? require('next/router') : undefined
          )
        }),
        new Sentry.Replay({
          // Mask sensitive data
          maskAllText: false,
          blockAllMedia: true,
          maskAllInputs: true
        })
      ]
    })

    this.initialized = true
    console.log('Monitoring service initialized')
  }

  // Set user context
  setUser(user: Partial<User>): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name || undefined
    })
  }

  // Clear user context
  clearUser(): void {
    Sentry.setUser(null)
  }

  // Set additional context
  setContext(key: string, context: any): void {
    Sentry.setContext(key, context)
  }

  // Add breadcrumb
  addBreadcrumb(message: string, category?: string, data?: any): void {
    Sentry.addBreadcrumb({
      message,
      category: category || 'app',
      data,
      timestamp: Date.now() / 1000
    })
  }

  // Capture exception
  captureException(error: Error, context?: ErrorContext): void {
    Sentry.withScope(scope => {
      if (context) {
        if (context.userId) {
          scope.setTag('userId', context.userId)
        }
        if (context.component) {
          scope.setTag('component', context.component)
        }
        if (context.action) {
          scope.setTag('action', context.action)
        }
        if (context.metadata) {
          scope.setContext('metadata', context.metadata)
        }
      }
      
      Sentry.captureException(error)
    })
  }

  // Capture message
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    Sentry.withScope(scope => {
      scope.setLevel(level)
      
      if (context) {
        if (context.userId) {
          scope.setTag('userId', context.userId)
        }
        if (context.component) {
          scope.setTag('component', context.component)
        }
        if (context.action) {
          scope.setTag('action', context.action)
        }
        if (context.metadata) {
          scope.setContext('metadata', context.metadata)
        }
      }
      
      Sentry.captureMessage(message)
    })
  }

  // Performance monitoring
  startTransaction(name: string, op?: string): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      op: op || 'navigation'
    })
  }

  // API performance monitoring
  trackAPICall(endpoint: string, method: string, duration: number, status: number): void {
    const transaction = Sentry.startTransaction({
      name: `${method} ${endpoint}`,
      op: 'http.client'
    })

    transaction.setTag('http.method', method)
    transaction.setTag('http.status_code', status.toString())
    transaction.setData('duration', duration)
    
    if (status >= 400) {
      transaction.setTag('error', true)
    }

    transaction.finish()
  }

  // Database query monitoring
  trackDatabaseQuery(query: string, duration: number, table?: string): void {
    const transaction = Sentry.startTransaction({
      name: `DB Query: ${table || 'unknown'}`,
      op: 'db.query'
    })

    transaction.setData('query', query)
    transaction.setData('duration', duration)
    
    if (table) {
      transaction.setTag('db.table', table)
    }

    if (duration > 1000) { // Slow query threshold
      transaction.setTag('slow_query', true)
      this.captureMessage(`Slow database query detected: ${duration}ms`, 'warning', {
        metadata: { query, table, duration }
      })
    }

    transaction.finish()
  }

  // Custom metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    // Add custom metric recording here
    // This could integrate with other services like DataDog, New Relic, etc.
    
    this.addBreadcrumb(`Metric: ${name} = ${value}`, 'metric', { tags })
    
    // Report to analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'custom_metric', {
        metric_name: name,
        metric_value: value,
        ...tags
      })
    }
  }

  // Error boundary helper
  static withErrorBoundary<P extends {}>(
    Component: React.ComponentType<P>,
    fallbackComponent?: React.ComponentType<any>
  ): React.ComponentType<P> {
    return Sentry.withErrorBoundary(Component, {
      fallback: fallbackComponent || ErrorFallback,
      showDialog: false
    })
  }
}

// Default error fallback component
export const ErrorFallback: React.FC<{
  error: Error
  componentStack: string
  resetError: () => void
}> = ({ error, resetError }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="flex-shrink-0">
          <svg
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Something went wrong
          </h3>
          <p className="text-sm text-gray-500">
            We've been notified about this error and will fix it soon.
          </p>
        </div>
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-gray-100 rounded text-sm font-mono text-gray-700">
          {error.message}
        </div>
      )}
      
      <div className="flex space-x-3">
        <button
          onClick={resetError}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
        >
          Go home
        </button>
      </div>
    </div>
  </div>
)

// React hooks for monitoring
export function useMonitoring() {
  const monitoring = MonitoringService.getInstance()
  
  return {
    captureException: monitoring.captureException.bind(monitoring),
    captureMessage: monitoring.captureMessage.bind(monitoring),
    addBreadcrumb: monitoring.addBreadcrumb.bind(monitoring),
    recordMetric: monitoring.recordMetric.bind(monitoring),
    trackAPICall: monitoring.trackAPICall.bind(monitoring)
  }
}

export function useErrorHandler() {
  const { captureException } = useMonitoring()
  
  return React.useCallback((error: Error, context?: ErrorContext) => {
    console.error('Error:', error)
    captureException(error, context)
  }, [captureException])
}

export function usePerformanceTracker(operationName: string) {
  const { recordMetric } = useMonitoring()
  
  return React.useCallback(() => {
    const startTime = performance.now()
    
    return {
      end: (metadata?: Record<string, any>) => {
        const duration = performance.now() - startTime
        recordMetric(`${operationName}_duration`, duration, metadata)
        
        if (duration > 100) { // Log slow operations
          console.warn(`Slow operation: ${operationName} took ${duration.toFixed(2)}ms`)
        }
      }
    }
  }, [operationName, recordMetric])
}

// API monitoring middleware
export function createAPIMonitoring() {
  const monitoring = MonitoringService.getInstance()
  
  return {
    onRequest: (req: Request) => {
      const startTime = Date.now()
      return { startTime }
    },
    
    onResponse: (
      req: Request,
      res: Response,
      context: { startTime: number }
    ) => {
      const duration = Date.now() - context.startTime
      const endpoint = new URL(req.url).pathname
      
      monitoring.trackAPICall(
        endpoint,
        req.method,
        duration,
        res.status
      )
      
      // Log slow API calls
      if (duration > 1000) {
        monitoring.captureMessage(
          `Slow API call: ${req.method} ${endpoint} took ${duration}ms`,
          'warning',
          {
            metadata: {
              method: req.method,
              endpoint,
              duration,
              status: res.status
            }
          }
        )
      }
    },
    
    onError: (req: Request, error: Error) => {
      const endpoint = new URL(req.url).pathname
      
      monitoring.captureException(error, {
        component: 'API',
        action: `${req.method} ${endpoint}`,
        metadata: {
          method: req.method,
          endpoint,
          headers: Object.fromEntries(req.headers.entries())
        }
      })
    }
  }
}

// Global monitoring instance
export const monitoringService = MonitoringService.getInstance()

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  monitoringService.initialize()
}

export default monitoringService