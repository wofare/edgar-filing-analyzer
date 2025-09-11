/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  poweredByHeader: false,
  
  // Enable compression
  compress: true,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Webpack optimizations
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundle size
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate vendor chunks
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20
            },
            // Common chunks
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true
            },
            // Chart libraries
            charts: {
              name: 'charts',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](recharts|d3)[\\/]/,
              priority: 30,
            },
            // UI components
            ui: {
              name: 'ui',
              chunks: 'all',
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
              priority: 25,
            }
          }
        }
      }

      // Tree shaking optimizations
      config.resolve.alias = {
        ...config.resolve.alias,
        // Use production builds of packages
        '@': require('path').resolve(__dirname, 'src')
      }
    }

    return config
  },

  // Experimental features for performance
  experimental: {
    // Enable modern JS for better performance
    esmExternals: true,
    
    // Optimize CSS
    optimizeCss: true,
    
    // Enable SWC minification
    swcMinify: true,
    
    // Enable concurrent features
    appDir: true,
  },

  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
    
    // Remove React DevTools
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options', 
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=1, stale-while-revalidate=59',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig