import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (request: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitResult {
  success: boolean
  limit?: number
  remaining?: number
  reset?: number
  retryAfter?: number
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store for rate limiting
// In production, use Redis or another distributed cache
const store: RateLimitStore = {}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key]
    }
  }
}, 60000) // Clean up every minute

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // API routes rate limits
  '/api/': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000 // per window
  },
  '/api/ingest': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // ingestion is expensive
  },
  '/api/price/': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300 // price data
  },
  '/api/filings': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // filing queries
  },
  '/api/stocks/': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200 // stock overview
  },
  '/api/settings/': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50 // settings changes
  },
  '/api/stripe/webhook': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000 // webhooks can be frequent
  }
}

function getClientKey(request: NextRequest): string {
  // Try to get user ID from headers first (for authenticated requests)
  const userId = request.headers.get('x-user-id')
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP-based rate limiting
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const remoteAddr = request.ip
  
  const ip = forwarded?.split(',')[0] || realIp || remoteAddr || 'unknown'
  return `ip:${ip}`
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  // Find the most specific matching config
  const sortedPaths = Object.keys(rateLimitConfigs).sort((a, b) => b.length - a.length)
  
  for (const path of sortedPaths) {
    if (pathname.startsWith(path)) {
      return rateLimitConfigs[path]
    }
  }

  // Default rate limit
  return {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000
  }
}

export async function rateLimit(request: NextRequest): Promise<RateLimitResult> {
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  
  const key = config.keyGenerator ? config.keyGenerator(request) : getClientKey(request)
  const fullKey = `${pathname}:${key}`
  
  const now = Date.now()
  const windowStart = now - config.windowMs
  
  // Get or create rate limit entry
  let entry = store[fullKey]
  
  if (!entry || entry.resetTime < now) {
    // Create new window
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    }
    store[fullKey] = entry
  }

  // Increment counter
  entry.count++

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const success = entry.count <= config.maxRequests

  const result: RateLimitResult = {
    success,
    limit: config.maxRequests,
    remaining,
    reset: Math.ceil(entry.resetTime / 1000), // Unix timestamp
    retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000)
  }

  // Log rate limit hits for monitoring
  if (!success) {
    console.warn(`Rate limit exceeded for ${fullKey}: ${entry.count}/${config.maxRequests}`)
  }

  return result
}

// Utility function to check rate limit without incrementing
export async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  
  const key = config.keyGenerator ? config.keyGenerator(request) : getClientKey(request)
  const fullKey = `${pathname}:${key}`
  
  const now = Date.now()
  const entry = store[fullKey]
  
  if (!entry || entry.resetTime < now) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((now + config.windowMs) / 1000)
    }
  }

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const success = entry.count < config.maxRequests

  return {
    success,
    limit: config.maxRequests,
    remaining,
    reset: Math.ceil(entry.resetTime / 1000),
    retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000)
  }
}

// Utility function to reset rate limit for a specific key
export async function resetRateLimit(request: NextRequest): Promise<void> {
  const pathname = request.nextUrl.pathname
  const config = getRateLimitConfig(pathname)
  
  const key = config.keyGenerator ? config.keyGenerator(request) : getClientKey(request)
  const fullKey = `${pathname}:${key}`
  
  delete store[fullKey]
}

// Custom rate limiter for specific use cases
export class CustomRateLimiter {
  private config: RateLimitConfig
  private store: RateLimitStore = {}

  constructor(config: RateLimitConfig) {
    this.config = config
    
    // Clean up old entries
    setInterval(() => {
      const now = Date.now()
      for (const key in this.store) {
        if (this.store[key].resetTime < now) {
          delete this.store[key]
        }
      }
    }, 60000)
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now()
    let entry = this.store[key]
    
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      }
      this.store[key] = entry
    }

    entry.count++

    const remaining = Math.max(0, this.config.maxRequests - entry.count)
    const success = entry.count <= this.config.maxRequests

    return {
      success,
      limit: this.config.maxRequests,
      remaining,
      reset: Math.ceil(entry.resetTime / 1000),
      retryAfter: success ? undefined : Math.ceil((entry.resetTime - now) / 1000)
    }
  }

  reset(key: string): void {
    delete this.store[key]
  }
}

// Pre-configured rate limiters for common use cases
export const edgarRateLimiter = new CustomRateLimiter({
  windowMs: 1000, // 1 second
  maxRequests: 10 // SEC EDGAR limit
})

export const priceDataRateLimiter = new CustomRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5 // per provider per minute
})

export const alertRateLimiter = new CustomRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // alerts per user per minute
})