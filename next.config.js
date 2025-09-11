/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', 'node-cron']
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=self, geolocation=self, interest-cohort=()'
          }
        ]
      },
      {
        // CORS headers for API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          }
        ]
      }
    ]
  },

  // Redirect configuration
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true
      },
      {
        source: '/login',
        destination: '/auth/signin',
        permanent: true
      },
      {
        source: '/register',
        destination: '/auth/signup',
        permanent: true
      }
    ]
  },

  // Rewrites for cleaner URLs
  async rewrites() {
    return [
      {
        source: '/s/:ticker',
        destination: '/stock/:ticker'
      }
    ]
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'WhatChanged'
  },

  // Image optimization
  images: {
    domains: [
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'cdn.stripe.com'
    ],
    formats: ['image/webp', 'image/avif']
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add support for reading files
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }

    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
          chunks: 'all'
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          chunks: 'all'
        }
      }
    }

    return config
  },

  // Output configuration
  output: 'standalone',

  // Compression
  compress: true,

  // Power consumption optimizations
  swcMinify: true,
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false
  },

  // ESLint configuration
  eslint: {
    dirs: ['pages', 'utils', 'components', 'lib', 'src']
  }
}

// Environment-specific configurations
if (process.env.NODE_ENV === 'production') {
  // Production optimizations
  nextConfig.compiler = {
    removeConsole: {
      exclude: ['error', 'warn']
    }
  }

  // Generate source maps in production for debugging
  nextConfig.productionBrowserSourceMaps = false
}

module.exports = nextConfig