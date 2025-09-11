import { withAuth } from 'next-auth/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { securityMiddleware } from '@/lib/security/middleware'

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/settings',
  '/watchlist',
  '/alerts',
  '/billing',
  '/api/user',
  '/api/watchlist',
  '/api/alerts',
  '/api/billing'
]

// Admin-only routes
const adminRoutes = [
  '/admin',
  '/api/admin'
]

// Public API routes that don't require auth
const publicAPIRoutes = [
  '/api/auth',
  '/api/webhook',
  '/api/health'
]

export default withAuth(
  async function middleware(request: NextRequest) {
    const token = request.nextauth?.token
    const { pathname } = request.nextUrl

    try {
      // Apply security middleware first
      const securityResponse = await securityMiddleware.applySecurityMiddleware(request)
      
      // If security middleware returns a response, use it
      if (securityResponse.status !== 200) {
        return securityResponse
      }

      // Check admin routes
      if (adminRoutes.some(route => pathname.startsWith(route))) {
        if (!token || token.role !== 'ADMIN') {
          return NextResponse.redirect(new URL('/auth/signin', request.url))
        }
      }

      // Check protected API routes
      if (pathname.startsWith('/api/') && !publicAPIRoutes.some(route => pathname.startsWith(route))) {
        if (!token) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        // Validate API request for protected endpoints
        const validation = await securityMiddleware.validateAPIRequest(request)
        if (!validation.success && validation.response) {
          return validation.response
        }
      }

      // Continue with the request
      return NextResponse.next()

    } catch (error) {
      console.error('Middleware error:', error)
      
      // For API routes, return JSON error
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        )
      }
      
      // For pages, redirect to error page
      return NextResponse.redirect(new URL('/error', request.url))
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // Allow access to public routes
        if (!protectedRoutes.some(route => pathname.startsWith(route))) {
          return true
        }

        // Require authentication for protected routes
        return !!token
      }
    }
  }
)

export const config = {
  matcher: [
    // Match all routes except static files and images
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
    // Always run for API routes
    '/api/:path*'
  ]
}