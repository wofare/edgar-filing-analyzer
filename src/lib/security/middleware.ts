import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ratelimit } from './ratelimit'

export interface SecurityHeaders {
  'Content-Security-Policy'?: string
  'X-Frame-Options'?: string
  'X-Content-Type-Options'?: string
  'X-XSS-Protection'?: string
  'Referrer-Policy'?: string
  'Permissions-Policy'?: string
  'Strict-Transport-Security'?: string
  'Access-Control-Allow-Origin'?: string
  'Access-Control-Allow-Methods'?: string
  'Access-Control-Allow-Headers'?: string
  'Access-Control-Allow-Credentials'?: string
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware
  private corsOrigins: string[]
  private rateLimitEnabled: boolean

  constructor() {
    this.corsOrigins = this.getAllowedOrigins()
    this.rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'
  }

  static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware()
    }
    return SecurityMiddleware.instance
  }

  private getAllowedOrigins(): string[] {
    const origins = [
      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    ]

    // Add additional allowed origins from environment
    if (process.env.ALLOWED_CORS_ORIGINS) {
      origins.push(...process.env.ALLOWED_CORS_ORIGINS.split(','))
    }

    // Development origins
    if (process.env.NODE_ENV === 'development') {
      origins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
      )
    }

    return origins
  }

  // Generate Content Security Policy
  private generateCSP(): string {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const isDevelopment = process.env.NODE_ENV === 'development'

    const cspDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-eval'", // Required for Next.js
        "'unsafe-inline'", // Required for some libraries
        'https://js.stripe.com',
        'https://www.googletagmanager.com',
        isDevelopment ? "'unsafe-eval'" : ''
      ].filter(Boolean),
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for styled-components and CSS-in-JS
        'https://fonts.googleapis.com'
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https://*.stripe.com',
        'https://*.gravatar.com',
        'https://*.googleusercontent.com'
      ],
      'connect-src': [
        "'self'",
        'https://*.stripe.com',
        'https://api.stripe.com',
        'https://www.google-analytics.com',
        isDevelopment ? 'ws://localhost:3000' : ''
      ].filter(Boolean),
      'frame-src': [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com'
      ],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    }

    return Object.entries(cspDirectives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive
        }
        return `${directive} ${sources.join(' ')}`
      })
      .join('; ')
  }

  // Get security headers
  getSecurityHeaders(origin?: string): SecurityHeaders {
    const headers: SecurityHeaders = {
      // Content Security Policy
      'Content-Security-Policy': this.generateCSP(),

      // Prevent clickjacking
      'X-Frame-Options': 'DENY',

      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',

      // XSS Protection
      'X-XSS-Protection': '1; mode=block',

      // Control referrer information
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Feature Policy / Permissions Policy
      'Permissions-Policy': [
        'camera=self',
        'microphone=self',
        'geolocation=self',
        'interest-cohort=()',
        'payment=self',
        'usb=()',
        'accelerometer=()',
        'gyroscope=()',
        'magnetometer=()'
      ].join(', ')
    }

    // HTTPS-only headers for production
    if (process.env.NODE_ENV === 'production') {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }

    // CORS headers
    if (origin && this.isOriginAllowed(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Credentials'] = 'true'
    }

    return headers
  }

  // Check if origin is allowed
  private isOriginAllowed(origin: string): boolean {
    return this.corsOrigins.includes(origin) || 
           this.corsOrigins.includes('*') ||
           (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost'))
  }

  // Handle CORS preflight requests
  async handleCORS(request: NextRequest): Promise<NextResponse | null> {
    const origin = request.headers.get('origin')
    const method = request.method

    // Handle preflight requests
    if (method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })
      
      if (origin && this.isOriginAllowed(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        )
        response.headers.set(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control'
        )
        response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
      }

      return response
    }

    return null
  }

  // Apply rate limiting
  async applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
    if (!this.rateLimitEnabled) {
      return null
    }

    const ip = this.getClientIP(request)
    const { success, limit, reset, remaining } = await ratelimit.limit(ip)

    if (!success) {
      const response = NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.'
        },
        { status: 429 }
      )

      response.headers.set('X-RateLimit-Limit', limit.toString())
      response.headers.set('X-RateLimit-Remaining', remaining.toString())
      response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString())
      response.headers.set('Retry-After', Math.round((reset - Date.now()) / 1000).toString())

      return response
    }

    return null
  }

  // Get client IP address
  private getClientIP(request: NextRequest): string {
    // Check various headers for the real IP
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const cfConnectingIp = request.headers.get('cf-connecting-ip')

    if (cfConnectingIp) {
      return cfConnectingIp
    }

    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    if (realIp) {
      return realIp
    }

    // Fallback to request IP
    return request.ip || '127.0.0.1'
  }

  // Validate API request
  async validateAPIRequest(request: NextRequest, requiredRole?: string): Promise<{
    success: boolean
    user?: any
    error?: string
    response?: NextResponse
  }> {
    try {
      // Get JWT token
      const token = await getToken({ 
        req: request,
        secret: process.env.NEXTAUTH_SECRET
      })

      if (!token) {
        return {
          success: false,
          error: 'Unauthorized',
          response: NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }
      }

      // Check if user is active
      if (!token.sub) {
        return {
          success: false,
          error: 'Invalid token',
          response: NextResponse.json(
            { error: 'Invalid authentication token' },
            { status: 401 }
          )
        }
      }

      // Check role if required
      if (requiredRole && token.role !== requiredRole && token.role !== 'ADMIN') {
        return {
          success: false,
          error: 'Insufficient permissions',
          response: NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      return {
        success: true,
        user: {
          id: token.sub,
          email: token.email,
          name: token.name,
          role: token.role
        }
      }
    } catch (error) {
      console.error('API request validation failed:', error)
      return {
        success: false,
        error: 'Authentication failed',
        response: NextResponse.json(
          { error: 'Authentication failed' },
          { status: 401 }
        )
      }
    }
  }

  // Sanitize input data
  sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .trim()
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item))
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value)
      }
      return sanitized
    }

    return data
  }

  // Validate request size
  validateRequestSize(request: NextRequest, maxSize: number = 1024 * 1024): boolean {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > maxSize) {
      return false
    }
    return true
  }

  // Check for suspicious patterns
  isSuspiciousRequest(request: NextRequest): boolean {
    const userAgent = request.headers.get('user-agent') || ''
    const path = request.nextUrl.pathname

    // Check for suspicious user agents
    const suspiciousUAs = [
      'curl',
      'wget',
      'python-requests',
      'bot',
      'crawler',
      'scraper'
    ]

    if (suspiciousUAs.some(ua => userAgent.toLowerCase().includes(ua))) {
      // Allow legitimate bots if they're accessing appropriate endpoints
      if (!path.startsWith('/api/webhook') && !path.startsWith('/sitemap')) {
        return true
      }
    }

    // Check for suspicious paths
    const suspiciousPaths = [
      '/admin',
      '/wp-admin',
      '/.env',
      '/config',
      '/.git',
      '/phpmyadmin'
    ]

    if (suspiciousPaths.some(sp => path.includes(sp))) {
      return true
    }

    return false
  }

  // Apply all security middleware
  async applySecurityMiddleware(request: NextRequest): Promise<NextResponse> {
    const origin = request.headers.get('origin')

    // Handle suspicious requests
    if (this.isSuspiciousRequest(request)) {
      console.warn(`Suspicious request blocked: ${request.nextUrl.pathname} from ${this.getClientIP(request)}`)
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Validate request size
    if (!this.validateRequestSize(request)) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      )
    }

    // Handle CORS preflight
    const corsResponse = await this.handleCORS(request)
    if (corsResponse) {
      return corsResponse
    }

    // Apply rate limiting
    const rateLimitResponse = await this.applyRateLimit(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Continue to next middleware or route handler
    const response = NextResponse.next()

    // Apply security headers
    const securityHeaders = this.getSecurityHeaders(origin)
    Object.entries(securityHeaders).forEach(([key, value]) => {
      if (value) {
        response.headers.set(key, value)
      }
    })

    return response
  }
}

// Global security middleware instance
export const securityMiddleware = SecurityMiddleware.getInstance()

export default securityMiddleware