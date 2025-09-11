import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Create Redis client for rate limiting
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
})

// Rate limiting configurations
export const rateLimitConfigs = {
  // Global API rate limit
  global: {
    requests: 100,
    window: '1 m'  // per minute
  },

  // Authentication endpoints
  auth: {
    requests: 10,
    window: '1 m'
  },

  // Password reset attempts
  passwordReset: {
    requests: 3,
    window: '15 m'
  },

  // Email verification
  emailVerification: {
    requests: 5,
    window: '1 h'
  },

  // SMS verification
  smsVerification: {
    requests: 3,
    window: '1 h'
  },

  // API endpoints (per user)
  api: {
    requests: 1000,
    window: '1 h'
  },

  // Webhook endpoints
  webhook: {
    requests: 1000,
    window: '1 m'
  },

  // File uploads
  upload: {
    requests: 10,
    window: '1 m'
  }
} as const

// Create rate limiters
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.global.requests, rateLimitConfigs.global.window),
  analytics: true,
})

export const authRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.auth.requests, rateLimitConfigs.auth.window),
  analytics: true,
})

export const passwordResetRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.passwordReset.requests, rateLimitConfigs.passwordReset.window),
  analytics: true,
})

export const emailVerificationRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.emailVerification.requests, rateLimitConfigs.emailVerification.window),
  analytics: true,
})

export const smsVerificationRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.smsVerification.requests, rateLimitConfigs.smsVerification.window),
  analytics: true,
})

export const apiRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.api.requests, rateLimitConfigs.api.window),
  analytics: true,
})

export const webhookRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.webhook.requests, rateLimitConfigs.webhook.window),
  analytics: true,
})

export const uploadRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(rateLimitConfigs.upload.requests, rateLimitConfigs.upload.window),
  analytics: true,
})

// Helper function to get the appropriate rate limiter
export function getRateLimiter(type: keyof typeof rateLimitConfigs): Ratelimit {
  switch (type) {
    case 'auth':
      return authRateLimit
    case 'passwordReset':
      return passwordResetRateLimit
    case 'emailVerification':
      return emailVerificationRateLimit
    case 'smsVerification':
      return smsVerificationRateLimit
    case 'api':
      return apiRateLimit
    case 'webhook':
      return webhookRateLimit
    case 'upload':
      return uploadRateLimit
    default:
      return ratelimit
  }
}

// Rate limiting middleware helper
export async function checkRateLimit(
  identifier: string,
  type: keyof typeof rateLimitConfigs = 'global'
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  try {
    const rateLimiter = getRateLimiter(type)
    return await rateLimiter.limit(identifier)
  } catch (error) {
    console.error('Rate limiting error:', error)
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0
    }
  }
}

export default ratelimit