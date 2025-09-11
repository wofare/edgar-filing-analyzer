import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Enhanced Prisma client with connection management and monitoring
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Connection pool configuration for production
    ...(process.env.NODE_ENV === 'production' && {
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL}?connection_limit=20&pool_timeout=20`,
        },
      },
    }),
  })

// Prevent multiple instances during development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Connection monitoring and health checks
export async function checkDatabaseConnection(): Promise<{
  isConnected: boolean
  latency?: number
  error?: string
}> {
  try {
    const start = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - start
    
    return {
      isConnected: true,
      latency
    }
  } catch (error) {
    console.error('Database connection check failed:', error)
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Database cleanup and connection management
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    console.log('Database disconnected successfully')
  } catch (error) {
    console.error('Error disconnecting from database:', error)
  }
}

// Transaction wrapper with retry logic
export async function withTransaction<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        return await operation(tx as PrismaClient)
      })
    } catch (error) {
      lastError = error as Error
      console.error(`Transaction attempt ${attempt} failed:`, error)
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        if (
          message.includes('unique constraint') ||
          message.includes('foreign key constraint') ||
          message.includes('check constraint')
        ) {
          throw error
        }
      }
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
      }
    }
  }
  
  throw lastError!
}

// Database migration status check
export async function checkMigrationStatus(): Promise<{
  isUpToDate: boolean
  pendingMigrations?: string[]
  error?: string
}> {
  try {
    // Check if _prisma_migrations table exists and get migration status
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      WHERE finished_at IS NULL
      ORDER BY started_at ASC
    ` as Array<{ migration_name: string; finished_at: Date | null }>

    return {
      isUpToDate: migrations.length === 0,
      pendingMigrations: migrations.map(m => m.migration_name)
    }
  } catch (error) {
    console.error('Migration status check failed:', error)
    return {
      isUpToDate: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Database statistics and monitoring
export async function getDatabaseStats() {
  try {
    const [
      userCount,
      companyCount,
      filingCount,
      alertCount,
      subscriptionCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.filing.count(),
      prisma.alert.count(),
      prisma.subscription.count()
    ])

    const recentFilings = await prisma.filing.count({
      where: {
        filedDate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: { in: ['active', 'trialing'] }
      }
    })

    return {
      users: userCount,
      companies: companyCount,
      filings: filingCount,
      alerts: alertCount,
      subscriptions: subscriptionCount,
      recentFilings,
      activeSubscriptions
    }
  } catch (error) {
    console.error('Failed to get database stats:', error)
    throw error
  }
}

// Cleanup old data to manage database size
export async function cleanupOldData(daysToKeep: number = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
    
    // Clean up old failed jobs
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        status: 'FAILED',
        completedAt: {
          lt: cutoffDate
        }
      }
    })

    // Clean up old alerts
    const deletedAlerts = await prisma.alert.deleteMany({
      where: {
        status: 'SENT',
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    // Clean up old payments
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        status: 'succeeded',
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    console.log(`Cleanup completed: ${deletedJobs.count} jobs, ${deletedAlerts.count} alerts, ${deletedPayments.count} payments`)
    
    return {
      deletedJobs: deletedJobs.count,
      deletedAlerts: deletedAlerts.count,
      deletedPayments: deletedPayments.count
    }
  } catch (error) {
    console.error('Data cleanup failed:', error)
    throw error
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase()
})

process.on('SIGINT', async () => {
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabase()
  process.exit(0)
})