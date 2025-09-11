import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/monitoring/logger'

interface QueryPerformanceResult {
  query: string
  executionTime: number
  rowCount?: number
  indexesUsed?: string[]
  warnings?: string[]
}

export class DatabaseOptimizer {
  private prisma: PrismaClient
  private performanceThresholds = {
    slow: 100,    // ms - log warning for queries taking longer
    critical: 1000 // ms - log error for very slow queries
  }

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // Analyze query performance with explain plans
  async analyzeQuery(sql: string): Promise<QueryPerformanceResult> {
    const startTime = performance.now()
    
    try {
      // Execute EXPLAIN ANALYZE for performance insights
      const explainResult = await this.prisma.$queryRaw`EXPLAIN ANALYZE ${sql}`
      const executionTime = performance.now() - startTime
      
      // Extract performance metrics from explain output
      const analysis = this.parseExplainAnalyze(explainResult as any[])
      
      return {
        query: sql,
        executionTime,
        ...analysis
      }
    } catch (error) {
      logger.error('Query analysis failed', {
        component: 'DatabaseOptimizer',
        metadata: { sql, error: (error as Error).message }
      })
      throw error
    }
  }

  // Monitor query performance automatically
  async withPerformanceMonitoring<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now()
    
    try {
      const result = await queryFn()
      const executionTime = performance.now() - startTime
      
      // Log performance metrics
      this.logQueryPerformance(operation, executionTime)
      
      return result
    } catch (error) {
      const executionTime = performance.now() - startTime
      logger.error(`Database operation failed: ${operation}`, {
        component: 'Database',
        metadata: {
          operation,
          executionTime,
          error: (error as Error).message
        }
      })
      throw error
    }
  }

  // Get slow query recommendations
  async getOptimizationRecommendations(): Promise<string[]> {
    const recommendations: string[] = []
    
    try {
      // Check for missing indexes on frequently queried columns
      const missingIndexes = await this.checkMissingIndexes()
      recommendations.push(...missingIndexes)
      
      // Check for inefficient queries
      const inefficientQueries = await this.checkInefficiientQueries()
      recommendations.push(...inefficientQueries)
      
      // Check table statistics
      const statisticsRecommendations = await this.checkTableStatistics()
      recommendations.push(...statisticsRecommendations)
      
    } catch (error) {
      logger.error('Failed to get optimization recommendations', {
        component: 'DatabaseOptimizer',
        metadata: { error: (error as Error).message }
      })
    }
    
    return recommendations
  }

  // Check for commonly used but unindexed query patterns
  private async checkMissingIndexes(): Promise<string[]> {
    const recommendations: string[] = []
    
    // These would typically come from query log analysis
    // For now, we'll check some common patterns
    
    try {
      // Check if we need indexes based on common query patterns
      const companyFilingsQuery = `
        SELECT count(*) FROM filings 
        WHERE "companyId" = 'some-id' 
        AND "filedDate" > NOW() - INTERVAL '1 year'
      `
      
      const userAlertsQuery = `
        SELECT count(*) FROM alerts 
        WHERE "userId" = 'some-id' 
        AND status = 'PENDING'
      `
      
      // Analyze these common patterns
      // In production, you'd analyze actual query logs
      recommendations.push('Consider composite indexes for frequent WHERE clause combinations')
      
    } catch (error) {
      logger.warn('Could not analyze missing indexes', { 
        metadata: { error: (error as Error).message } 
      })
    }
    
    return recommendations
  }

  // Check for queries that could benefit from optimization
  private async checkInefficiientQueries(): Promise<string[]> {
    const recommendations: string[] = []
    
    try {
      // Check for table scans on large tables
      const tableStats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins + n_tup_upd + n_tup_del as total_writes,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch
        FROM pg_stat_user_tables 
        WHERE seq_scan > idx_scan * 2
        ORDER BY seq_scan DESC
        LIMIT 10
      ` as any[]
      
      if (tableStats.length > 0) {
        recommendations.push('Some tables are performing more sequential scans than index scans')
        tableStats.forEach(stat => {
          recommendations.push(`Table ${stat.tablename} has ${stat.seq_scan} seq scans vs ${stat.idx_scan} index scans`)
        })
      }
      
    } catch (error) {
      logger.warn('Could not analyze inefficient queries', { 
        metadata: { error: (error as Error).message } 
      })
    }
    
    return recommendations
  }

  // Check table statistics and suggest maintenance
  private async checkTableStatistics(): Promise<string[]> {
    const recommendations: string[] = []
    
    try {
      // Check table bloat and statistics
      const statsInfo = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_dead_tup,
          n_live_tup,
          last_vacuum,
          last_analyze
        FROM pg_stat_user_tables
        WHERE n_dead_tup > n_live_tup * 0.1
        ORDER BY n_dead_tup DESC
        LIMIT 5
      ` as any[]
      
      if (statsInfo.length > 0) {
        recommendations.push('Some tables may benefit from VACUUM and ANALYZE operations')
        statsInfo.forEach(stat => {
          recommendations.push(`Table ${stat.tablename} has ${stat.n_dead_tup} dead tuples`)
        })
      }
      
    } catch (error) {
      logger.warn('Could not check table statistics', { 
        metadata: { error: (error as Error).message } 
      })
    }
    
    return recommendations
  }

  // Parse EXPLAIN ANALYZE output for insights
  private parseExplainAnalyze(explainOutput: any[]): Partial<QueryPerformanceResult> {
    const result: Partial<QueryPerformanceResult> = {
      warnings: []
    }
    
    try {
      explainOutput.forEach(row => {
        const line = row['QUERY PLAN'] || ''
        
        // Look for sequential scans
        if (line.includes('Seq Scan')) {
          result.warnings?.push('Query contains sequential scan - consider adding index')
        }
        
        // Look for nested loops with high cost
        if (line.includes('Nested Loop') && line.includes('cost=')) {
          const cost = this.extractCost(line)
          if (cost > 1000) {
            result.warnings?.push(`High-cost nested loop detected (cost: ${cost})`)
          }
        }
        
        // Extract row count estimates
        if (line.includes('rows=')) {
          const rows = this.extractRows(line)
          result.rowCount = rows
        }
      })
      
    } catch (error) {
      result.warnings?.push('Could not parse explain output')
    }
    
    return result
  }

  private extractCost(line: string): number {
    const match = line.match(/cost=[\d.]+\.\.([\d.]+)/)
    return match ? parseFloat(match[1]) : 0
  }

  private extractRows(line: string): number {
    const match = line.match(/rows=([\d]+)/)
    return match ? parseInt(match[1]) : 0
  }

  private logQueryPerformance(operation: string, executionTime: number): void {
    if (executionTime > this.performanceThresholds.critical) {
      logger.error(`Critical slow query: ${operation} took ${executionTime.toFixed(2)}ms`, {
        component: 'Database',
        metadata: { operation, executionTime, level: 'critical' }
      })
    } else if (executionTime > this.performanceThresholds.slow) {
      logger.warn(`Slow query detected: ${operation} took ${executionTime.toFixed(2)}ms`, {
        component: 'Database',
        metadata: { operation, executionTime, level: 'warning' }
      })
    } else {
      logger.debug(`Query completed: ${operation} in ${executionTime.toFixed(2)}ms`, {
        component: 'Database',
        metadata: { operation, executionTime }
      })
    }
  }

  // Get database performance metrics
  async getDatabaseMetrics(): Promise<Record<string, any>> {
    try {
      const [
        connectionStats,
        tableStats,
        indexStats,
        lockStats
      ] = await Promise.all([
        this.getConnectionStats(),
        this.getTableStats(),
        this.getIndexStats(),
        this.getLockStats()
      ])

      return {
        connections: connectionStats,
        tables: tableStats,
        indexes: indexStats,
        locks: lockStats,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('Failed to get database metrics', {
        component: 'DatabaseOptimizer',
        metadata: { error: (error as Error).message }
      })
      return {}
    }
  }

  private async getConnectionStats(): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT 
        state,
        COUNT(*) as count
      FROM pg_stat_activity 
      WHERE datname = current_database()
      GROUP BY state
    ` as any[]
  }

  private async getTableStats(): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins + n_tup_upd + n_tup_del as total_writes,
        n_tup_del as deletes,
        seq_scan,
        idx_scan,
        n_live_tup,
        n_dead_tup
      FROM pg_stat_user_tables
      ORDER BY total_writes DESC
      LIMIT 10
    ` as any[]
  }

  private async getIndexStats(): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE idx_scan > 0
      ORDER BY idx_scan DESC
      LIMIT 10
    ` as any[]
  }

  private async getLockStats(): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT 
        mode,
        COUNT(*) as count
      FROM pg_locks
      WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      GROUP BY mode
    ` as any[]
  }
}

// Utility functions for common optimization patterns
export class QueryOptimizer {
  // Optimize filing queries with proper indexing
  static getOptimizedFilingQuery(prisma: PrismaClient) {
    return {
      // Get recent filings for a company with minimal data transfer
      getRecentFilings: (companyId: string, limit = 10) =>
        prisma.filing.findMany({
          where: { companyId },
          select: {
            id: true,
            accessionNo: true,
            formType: true,
            filedDate: true,
            summary: true,
            materialChanges: true,
            totalChanges: true
          },
          orderBy: { filedDate: 'desc' },
          take: limit
        }),

      // Get filings with material changes efficiently  
      getMaterialFilings: (threshold = 0.7, limit = 20) =>
        prisma.filing.findMany({
          where: {
            materialChanges: { gt: 0 },
            processed: true
          },
          select: {
            id: true,
            accessionNo: true,
            formType: true,
            filedDate: true,
            summary: true,
            materialChanges: true,
            company: {
              select: {
                symbol: true,
                name: true
              }
            }
          },
          orderBy: { materialChanges: 'desc' },
          take: limit
        }),

      // Search filings efficiently using full-text search
      searchFilings: (searchTerm: string, limit = 25) =>
        prisma.$queryRaw`
          SELECT f.id, f."accessionNo", f."formType", f."filedDate", 
                 f.summary, f."materialChanges", c.symbol, c.name
          FROM filings f
          JOIN companies c ON f."companyId" = c.id
          WHERE to_tsvector('english', f.summary || ' ' || array_to_string(f."keyHighlights", ' ')) 
                @@ plainto_tsquery('english', ${searchTerm})
          ORDER BY f."filedDate" DESC
          LIMIT ${limit}
        `
    }
  }

  // Optimize user alert queries
  static getOptimizedAlertQuery(prisma: PrismaClient) {
    return {
      // Get user alerts efficiently
      getUserAlerts: (userId: string, limit = 50) =>
        prisma.alert.findMany({
          where: { userId },
          select: {
            id: true,
            type: true,
            title: true,
            message: true,
            createdAt: true,
            sentAt: true,
            status: true,
            filing: {
              select: {
                formType: true,
                filedDate: true,
                company: {
                  select: {
                    symbol: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit
        }),

      // Get pending alerts for processing
      getPendingAlerts: (method?: string, limit = 100) =>
        prisma.alert.findMany({
          where: {
            status: 'PENDING',
            ...(method && { method })
          },
          select: {
            id: true,
            userId: true,
            type: true,
            method: true,
            title: true,
            message: true,
            user: {
              select: {
                email: true,
                phone: true,
                emailEnabled: true,
                smsEnabled: true,
                pushEnabled: true
              }
            },
            filing: {
              select: {
                formType: true,
                company: {
                  select: {
                    symbol: true,
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'asc' },
          take: limit
        })
    }
  }
}

export default DatabaseOptimizer