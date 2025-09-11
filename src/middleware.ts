import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

interface RequestWithStartTime extends NextRequest {
  startTime?: number
}

export async function middleware(request: RequestWithStartTime) {
  const startTime = Date.now()
  request.startTime = startTime

  // Skip middleware for static files and internal Next.js routes
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api/_') ||
    request.nextUrl.pathname.includes('.') ||
    request.nextUrl.pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  try {
    // Rate limiting for API routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const rateLimitResult = await rateLimit(request)
      
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: rateLimitResult.retryAfter
          },
          { 
            status: 429,
            headers: {
              'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
              'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '100',
              'X-RateLimit-Remaining': rateLimitResult.remaining?.toString() || '0',
              'X-RateLimit-Reset': rateLimitResult.reset?.toString() || ''
            }
          }
        )
      }

      // Add rate limit headers to successful requests
      const response = NextResponse.next()
      if (rateLimitResult.limit) {
        response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      }
      if (rateLimitResult.remaining !== undefined) {
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      }
      if (rateLimitResult.reset) {
        response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())
      }

      return response
    }

    return NextResponse.next()

  } catch (error) {
    console.error('Middleware error:', error)
    
    // Return a generic error response to avoid exposing internal details
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'MIDDLEWARE_ERROR'
      },
      { status: 500 }
    )
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}