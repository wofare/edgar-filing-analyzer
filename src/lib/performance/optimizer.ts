import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export interface PerformanceMetrics {
  responseTime: number
  dbQueryTime: number
  memoryUsage: number
  cacheHits: number
  cacheMisses: number
}

export interface CacheEntry<T = any> {
  data: T
  expiry: number
  version: string
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer
  private cache = new Map<string, CacheEntry>()
  private metrics = new Map<string, PerformanceMetrics[]>()
  private readonly defaultTTL = 5 * 60 * 1000 // 5 minutes

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer()
    }
    return PerformanceOptimizer.instance
  }

  // Cache management
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const expiry = Date.now() + ttl
    this.cache.set(key, {
      data,
      expiry,
      version: '1.0'
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.recordCacheMiss(key)
      return null
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      this.recordCacheMiss(key)
      return null
    }

    this.recordCacheHit(key)
    return entry.data as T
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Database query optimization
  async optimizeCompanyQuery(userId: string, limit: number = 50) {
    const cacheKey = `companies:${userId}:${limit}`
    const cached = this.get<any[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const startTime = Date.now()
    
    try {
      // Optimized query with selective fields and proper indexing
      const companies = await prisma.company.findMany({
        where: {
          isActive: true,
          watchlists: {
            some: {
              userId: userId,
              isActive: true
            }
          }
        },
        select: {
          id: true,
          symbol: true,
          name: true,
          industry: true,
          currentPrice: true,
          priceChange: true,
          priceChangePercent: true,
          lastPriceUpdate: true,
          _count: {
            select: {
              filings: {
                where: {
                  filedDate: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                  }
                }
              }
            }
          }
        },
        orderBy: [
          { lastPriceUpdate: 'desc' },
          { symbol: 'asc' }
        ],
        take: limit
      })

      const queryTime = Date.now() - startTime
      
      // Cache for 5 minutes
      this.set(cacheKey, companies, 5 * 60 * 1000)
      
      this.recordMetrics('company_query', queryTime, 0)
      
      return companies
    } catch (error) {
      console.error('Company query optimization failed:', error)
      throw error
    }
  }

  async optimizeFilingsQuery(companyId: string, limit: number = 20) {
    const cacheKey = `filings:${companyId}:${limit}`
    const cached = this.get<any[]>(cacheKey)
    
    if (cached) {
      return cached
    }

    const startTime = Date.now()
    
    try {
      const filings = await prisma.filing.findMany({
        where: {
          companyId: companyId,
          isProcessed: true
        },
        select: {
          id: true,
          accessionNo: true,
          formType: true,
          filedDate: true,
          reportDate: true,
          summary: true,
          keyHighlights: true,
          investorImplications: true,
          _count: {
            select: {
              diffs: {
                where: {
                  materialityScore: {
                    gte: 0.7
                  }
                }
              }
            }
          }
        },
        orderBy: {
          filedDate: 'desc'
        },
        take: limit
      })

      const queryTime = Date.now() - startTime
      
      // Cache for 10 minutes
      this.set(cacheKey, filings, 10 * 60 * 1000)
      
      this.recordMetrics('filings_query', queryTime, 0)
      
      return filings
    } catch (error) {
      console.error('Filings query optimization failed:', error)
      throw error
    }
  }

  async optimizeDashboardData(userId: string) {
    const cacheKey = `dashboard:${userId}`
    const cached = this.get<any>(cacheKey)
    
    if (cached) {
      return cached
    }

    const startTime = Date.now()
    
    try {
      // Parallel queries for dashboard data
      const [
        userLimits,
        companiesData,
        recentAlerts,
        summary
      ] = await Promise.all([
        this.getUserLimitsOptimized(userId),
        this.getWatchlistSummary(userId),
        this.getRecentAlerts(userId, 5),
        this.getPortfolioSummary(userId)
      ])

      const dashboardData = {
        userLimits,
        companies: companiesData,
        alerts: recentAlerts,
        summary,
        lastUpdated: new Date().toISOString()
      }

      const queryTime = Date.now() - startTime
      
      // Cache for 2 minutes (frequently updated data)
      this.set(cacheKey, dashboardData, 2 * 60 * 1000)
      
      this.recordMetrics('dashboard_query', queryTime, 0)
      
      return dashboardData
    } catch (error) {
      console.error('Dashboard optimization failed:', error)
      throw error
    }
  }

  // Performance monitoring
  private recordCacheHit(key: string): void {
    const endpoint = this.extractEndpoint(key)
    this.updateMetric(endpoint, 'cacheHits')
  }

  private recordCacheMiss(key: string): void {
    const endpoint = this.extractEndpoint(key)
    this.updateMetric(endpoint, 'cacheMisses')
  }

  private recordMetrics(endpoint: string, responseTime: number, dbQueryTime: number): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, [])
    }

    const endpointMetrics = this.metrics.get(endpoint)!
    endpointMetrics.push({
      responseTime,
      dbQueryTime,
      memoryUsage: process.memoryUsage().heapUsed,
      cacheHits: 0,
      cacheMisses: 0
    })

    // Keep only last 100 metrics per endpoint
    if (endpointMetrics.length > 100) {
      endpointMetrics.shift()
    }
  }

  private updateMetric(endpoint: string, metric: keyof PerformanceMetrics): void {
    const endpointMetrics = this.metrics.get(endpoint)
    if (endpointMetrics && endpointMetrics.length > 0) {
      const lastMetric = endpointMetrics[endpointMetrics.length - 1]
      if (typeof lastMetric[metric] === 'number') {
        ;(lastMetric[metric] as number)++
      }
    }
  }

  private extractEndpoint(key: string): string {
    return key.split(':')[0]
  }

  // Optimized helper queries
  private async getUserLimitsOptimized(userId: string) {
    const cacheKey = `limits:${userId}`
    const cached = this.get<any>(cacheKey)
    
    if (cached) {
      return cached
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscription: {
          select: {
            status: true,
            planId: true
          }
        },
        _count: {
          select: {
            watchlists: {
              where: { isActive: true }
            },
            alerts: true
          }
        }
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Apply plan limits logic
    let limits = {
      watchlistLimit: 3,
      alertLimit: 50,
      canUseSMS: false,
      canUseAPI: false
    }

    if (user.subscription && user.subscription.status === 'active') {
      const { stripeService } = await import('@/lib/stripe/service')
      const plan = stripeService.getPlan(user.subscription.planId)
      
      if (plan) {
        limits = {
          watchlistLimit: plan.watchlistLimit === -1 ? 999999 : plan.watchlistLimit,
          alertLimit: plan.alertLimit === -1 ? 999999 : plan.alertLimit,
          canUseSMS: plan.id !== 'free',
          canUseAPI: plan.id === 'pro' || plan.id === 'pro-annual'
        }
      }
    }

    const result = {
      ...limits,
      currentWatchlistCount: user._count.watchlists,
      currentAlertCount: user._count.alerts
    }

    // Cache for 10 minutes
    this.set(cacheKey, result, 10 * 60 * 1000)
    
    return result
  }

  private async getWatchlistSummary(userId: string) {
    return await prisma.watchlist.findMany({
      where: {
        userId: userId,
        isActive: true
      },
      select: {
        id: true,
        company: {
          select: {
            id: true,
            symbol: true,
            name: true,
            currentPrice: true,
            priceChange: true,
            priceChangePercent: true,
            industry: true
          }
        },
        alertsEnabled: true,
        materialityThreshold: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  private async getRecentAlerts(userId: string, limit: number) {
    return await prisma.alert.findMany({
      where: {
        userId: userId
      },
      select: {
        id: true,
        type: true,
        message: true,
        createdAt: true,
        status: true,
        filing: {
          select: {
            ticker: true,
            companyName: true,
            formType: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })
  }

  private async getPortfolioSummary(userId: string) {
    const watchlists = await prisma.watchlist.count({
      where: {
        userId: userId,
        isActive: true
      }
    })

    const alerts = await prisma.alert.count({
      where: {
        userId: userId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    return {
      totalCompanies: watchlists,
      alertsThisWeek: alerts,
      lastActivity: new Date().toISOString()
    }
  }

  // Performance analysis
  getPerformanceStats(endpoint?: string) {
    if (endpoint) {
      const metrics = this.metrics.get(endpoint) || []
      return this.calculateStats(metrics)
    }

    const allStats: Record<string, any> = {}
    for (const [endpointName, metrics] of this.metrics) {
      allStats[endpointName] = this.calculateStats(metrics)
    }
    
    return allStats
  }

  private calculateStats(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) {
      return {
        count: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        cacheHitRate: 0
      }
    }

    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b)
    const totalCacheHits = metrics.reduce((sum, m) => sum + m.cacheHits, 0)
    const totalCacheMisses = metrics.reduce((sum, m) => sum + m.cacheMisses, 0)
    const totalCacheRequests = totalCacheHits + totalCacheMisses

    return {
      count: metrics.length,
      avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / metrics.length,
      p50ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)],
      cacheHitRate: totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0
    }
  }

  // Memory cleanup
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        expiredKeys.push(key)
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key))
    
    // Keep metrics reasonable
    for (const [endpoint, metrics] of this.metrics) {
      if (metrics.length > 100) {
        this.metrics.set(endpoint, metrics.slice(-50))
      }
    }
  }

  // Middleware for automatic performance tracking
  middleware() {
    return (req: NextRequest) => {
      const startTime = Date.now()
      
      return NextResponse.next().then(response => {
        const endTime = Date.now()
        const responseTime = endTime - startTime
        
        const endpoint = req.nextUrl.pathname
        this.recordMetrics(endpoint, responseTime, 0)
        
        // Add performance headers
        response.headers.set('X-Response-Time', `${responseTime}ms`)
        response.headers.set('X-Cache-Status', 'MISS') // Default, would be updated by cache layer
        
        return response
      })
    }
  }
}

// Global performance optimizer instance
export const performanceOptimizer = PerformanceOptimizer.getInstance()

// Cleanup interval
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    performanceOptimizer.cleanup()
  }, 5 * 60 * 1000) // Every 5 minutes
}

export default performanceOptimizer