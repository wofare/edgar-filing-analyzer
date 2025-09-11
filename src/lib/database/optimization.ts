import { prisma } from '@/lib/db'
import { logger } from '@/lib/monitoring/logger'

export interface QueryPerformanceMetrics {
  query: string
  executionTime: number
  rowsAffected: number
  indexesUsed: string[]
  recommendations?: string[]
}

export interface IndexAnalysis {
  indexName: string
  tableName: string
  size: string
  scansCount: number
  tuplesRead: number
  tuplesReturned: number
  isUnused: boolean
  recommendations: string[]
}

export class DatabaseOptimizer {
  private static instance: DatabaseOptimizer
  private readonly SLOW_QUERY_THRESHOLD = 1000 // 1 second
  private queryCache = new Map<string, any>()

  static getInstance(): DatabaseOptimizer {
    if (!DatabaseOptimizer.instance) {
      DatabaseOptimizer.instance = new DatabaseOptimizer()
    }
    return DatabaseOptimizer.instance
  }

  // Query performance monitoring
  async executeWithMetrics<T>(
    queryName: string,
    queryFunction: () => Promise<T>
  ): Promise<{ result: T; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now()
    const queryStart = process.hrtime.bigint()

    try {
      const result = await queryFunction()
      
      const executionTime = Date.now() - startTime
      const queryEnd = process.hrtime.bigint()
      const preciseTime = Number(queryEnd - queryStart) / 1_000_000 // Convert to milliseconds

      const metrics: QueryPerformanceMetrics = {
        query: queryName,
        executionTime: preciseTime,
        rowsAffected: Array.isArray(result) ? result.length : 1,
        indexesUsed: [], // Would need to parse EXPLAIN output for actual indexes
        recommendations: this.generateRecommendations(queryName, preciseTime)
      }

      // Log slow queries
      if (executionTime > this.SLOW_QUERY_THRESHOLD) {
        logger.warn(`Slow query detected: ${queryName}`, {
          component: 'Database',
          action: 'slow_query',
          metadata: {
            executionTime,
            queryName
          }
        })
      }

      // Log to monitoring
      logger.logDatabaseQuery(queryName, executionTime)

      return { result, metrics }
    } catch (error) {
      logger.error(`Query failed: ${queryName}`, error as Error, {
        component: 'Database',
        action: 'query_error'
      })
      throw error
    }
  }

  // Optimized query methods
  async getOptimizedUserWatchlist(userId: string, limit: number = 50) {
    const cacheKey = `watchlist:${userId}:${limit}`
    const cached = this.queryCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
      return cached.data
    }

    const { result } = await this.executeWithMetrics(
      'getOptimizedUserWatchlist',
      () => prisma.watchlist.findMany({
        where: {
          userId,
          isActive: true
        },
        select: {
          id: true,
          alertsEnabled: true,
          materialityThreshold: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              symbol: true,
              name: true,
              industry: true,
              currentPrice: true,
              priceChange: true,
              priceChangePercent: true,
              lastPriceUpdate: true
            }
          }
        },
        orderBy: [
          { company: { lastPriceUpdate: 'desc' } },
          { createdAt: 'desc' }
        ],
        take: limit
      })
    )

    // Cache result
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    return result
  }

  async getOptimizedRecentFilings(companyId: string, limit: number = 20) {
    const cacheKey = `filings:${companyId}:${limit}`
    const cached = this.queryCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minutes
      return cached.data
    }

    const { result } = await this.executeWithMetrics(
      'getOptimizedRecentFilings',
      () => prisma.filing.findMany({
        where: {
          companyId,
          isProcessed: true,
          filedDate: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
          }
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
          diffs: {
            where: {
              materialityScore: { gte: 0.7 }
            },
            select: {
              id: true,
              section: true,
              materialityScore: true,
              changeType: true
            },
            take: 5
          }
        },
        orderBy: {
          filedDate: 'desc'
        },
        take: limit
      })
    )

    // Cache result
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    return result
  }

  async getOptimizedDashboardStats(userId: string) {
    const cacheKey = `dashboard_stats:${userId}`
    const cached = this.queryCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) { // 2 minutes
      return cached.data
    }

    const { result } = await this.executeWithMetrics(
      'getOptimizedDashboardStats',
      async () => {
        // Use Promise.all for parallel queries
        const [
          watchlistCount,
          recentAlertsCount,
          totalAlertsCount,
          activeSubscription,
          recentFilingsCount
        ] = await Promise.all([
          prisma.watchlist.count({
            where: { userId, isActive: true }
          }),
          
          prisma.alert.count({
            where: {
              userId,
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          }),
          
          prisma.alert.count({ where: { userId } }),
          
          prisma.subscription.findUnique({
            where: { userId },
            select: { status: true, planId: true, currentPeriodEnd: true }
          }),
          
          prisma.filing.count({
            where: {
              company: {
                watchlists: {
                  some: { userId, isActive: true }
                }
              },
              filedDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              isProcessed: true
            }
          })
        ])

        return {
          watchlistCount,
          recentAlertsCount,
          totalAlertsCount,
          activeSubscription,
          recentFilingsCount
        }
      }
    )

    // Cache result
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    return result
  }

  // Batch operations for efficiency
  async batchUpdatePrices(priceUpdates: Array<{
    companyId: string
    currentPrice: number
    priceChange: number
    priceChangePercent: number
  }>) {
    const { result } = await this.executeWithMetrics(
      'batchUpdatePrices',
      async () => {
        // Use transaction for batch updates
        const results = await prisma.$transaction(
          priceUpdates.map(update => 
            prisma.company.update({
              where: { id: update.companyId },
              data: {
                currentPrice: update.currentPrice,
                priceChange: update.priceChange,
                priceChangePercent: update.priceChangePercent,
                lastPriceUpdate: new Date()
              }
            })
          )
        )

        // Invalidate related caches
        this.invalidateCachePattern(/^(dashboard_stats|watchlist):/)

        return results
      }
    )

    return result
  }

  async batchCreateAlerts(alerts: Array<{
    userId: string
    type: string
    message: string
    filingId?: string
    metadata?: any
  }>) {
    const { result } = await this.executeWithMetrics(
      'batchCreateAlerts',
      () => prisma.alert.createMany({
        data: alerts.map(alert => ({
          ...alert,
          scheduledFor: new Date()
        }))
      })
    )

    // Invalidate user dashboard caches
    alerts.forEach(alert => {
      this.queryCache.delete(`dashboard_stats:${alert.userId}`)
    })

    return result
  }

  // Index analysis and recommendations
  async analyzeIndexUsage(): Promise<IndexAnalysis[]> {
    try {
      // PostgreSQL specific query to analyze index usage
      const indexStats = await prisma.$queryRaw<any[]>`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans_count,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_returned,
          pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
      `

      return indexStats.map(stat => ({
        indexName: stat.indexname,
        tableName: stat.tablename,
        size: stat.size,
        scansCount: stat.scans_count || 0,
        tuplesRead: stat.tuples_read || 0,
        tuplesReturned: stat.tuples_returned || 0,
        isUnused: stat.scans_count === 0,
        recommendations: this.generateIndexRecommendations(stat)
      }))
    } catch (error) {
      logger.error('Failed to analyze index usage', error as Error)
      return []
    }
  }

  async identifyMissingIndexes(): Promise<string[]> {
    const recommendations: string[] = []

    try {
      // Check for missing indexes on common query patterns
      const slowQueries = await prisma.$queryRaw<any[]>`
        SELECT query, calls, total_time, mean_time
        FROM pg_stat_statements 
        WHERE mean_time > 100 -- queries taking more than 100ms on average
        ORDER BY mean_time DESC 
        LIMIT 10
      `

      slowQueries.forEach(query => {
        const queryText = query.query.toLowerCase()
        
        // Suggest indexes based on WHERE clauses
        if (queryText.includes('where') && queryText.includes('user')) {
          if (!queryText.includes('btree')) {
            recommendations.push('Consider adding index on user-related columns')
          }
        }
        
        if (queryText.includes('order by') && queryText.includes('created_at')) {
          recommendations.push('Consider adding index on created_at for sorting')
        }

        if (queryText.includes('where') && queryText.includes('status')) {
          recommendations.push('Consider adding index on status columns')
        }
      })
    } catch (error) {
      logger.warn('Could not analyze pg_stat_statements', {
        component: 'Database',
        metadata: { error: (error as Error).message }
      })
    }

    return recommendations
  }

  // Query optimization suggestions
  private generateRecommendations(queryName: string, executionTime: number): string[] {
    const recommendations: string[] = []

    if (executionTime > 2000) {
      recommendations.push('Consider adding pagination to reduce result set size')
      recommendations.push('Review WHERE clauses for proper indexing')
    }

    if (executionTime > 5000) {
      recommendations.push('Query is very slow - investigate with EXPLAIN ANALYZE')
      recommendations.push('Consider breaking down into smaller queries')
    }

    if (queryName.includes('count') && executionTime > 500) {
      recommendations.push('Consider using estimated counts for large tables')
    }

    return recommendations
  }

  private generateIndexRecommendations(indexStat: any): string[] {
    const recommendations: string[] = []

    if (indexStat.scans_count === 0) {
      recommendations.push('Index is unused and can be dropped')
    } else if (indexStat.scans_count < 10) {
      recommendations.push('Index has very low usage - consider dropping')
    }

    if (indexStat.tuples_read > indexStat.tuples_returned * 10) {
      recommendations.push('Index may not be selective enough')
    }

    return recommendations
  }

  // Cache management
  invalidateCache(key: string): void {
    this.queryCache.delete(key)
  }

  invalidateCachePattern(pattern: RegExp): void {
    for (const key of this.queryCache.keys()) {
      if (pattern.test(key)) {
        this.queryCache.delete(key)
      }
    }
  }

  clearCache(): void {
    this.queryCache.clear()
  }

  // Database maintenance
  async performMaintenance(): Promise<{
    indexesAnalyzed: number
    cacheCleared: boolean
    recommendations: string[]
  }> {
    logger.info('Starting database maintenance', {
      component: 'Database',
      action: 'maintenance'
    })

    const indexAnalysis = await this.analyzeIndexUsage()
    const missingIndexes = await this.identifyMissingIndexes()
    
    // Clear old cache entries
    this.clearCache()

    // Update table statistics
    try {
      await prisma.$executeRaw`ANALYZE`
      logger.info('Database statistics updated')
    } catch (error) {
      logger.error('Failed to update database statistics', error as Error)
    }

    const recommendations = [
      ...missingIndexes,
      ...indexAnalysis
        .filter(index => index.recommendations.length > 0)
        .flatMap(index => index.recommendations)
    ]

    logger.info('Database maintenance completed', {
      component: 'Database',
      action: 'maintenance_completed',
      metadata: {
        indexesAnalyzed: indexAnalysis.length,
        recommendations: recommendations.length
      }
    })

    return {
      indexesAnalyzed: indexAnalysis.length,
      cacheCleared: true,
      recommendations
    }
  }

  // Performance monitoring
  getCacheStats() {
    return {
      size: this.queryCache.size,
      keys: Array.from(this.queryCache.keys())
    }
  }
}

// Global instance
export const databaseOptimizer = DatabaseOptimizer.getInstance()

// Periodic maintenance
if (typeof window === 'undefined') { // Server-side only
  // Run maintenance every 4 hours
  setInterval(async () => {
    try {
      await databaseOptimizer.performMaintenance()
    } catch (error) {
      logger.error('Scheduled database maintenance failed', error as Error)
    }
  }, 4 * 60 * 60 * 1000)
}

export default databaseOptimizer