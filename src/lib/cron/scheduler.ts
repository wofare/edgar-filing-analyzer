import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { jobQueue, JobHelpers } from '@/lib/jobs/queue'
import { createEDGARClient } from '@/lib/edgar-client'

export interface CronJobConfig {
  name: string
  schedule: string
  task: () => Promise<void>
  enabled: boolean
  timezone?: string
}

export class CronScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map()
  private isInitialized = false

  // Initialize all cron jobs
  async initialize() {
    if (this.isInitialized) {
      console.log('Cron scheduler already initialized')
      return
    }

    console.log('Initializing cron scheduler...')

    try {
      // Define all cron jobs
      const cronJobs: CronJobConfig[] = [
        // Every 15 minutes: Poll EDGAR for new filings from active companies
        {
          name: 'edgar-polling',
          schedule: '*/15 * * * *',
          task: this.edgarPollingTask.bind(this),
          enabled: true
        },

        // Every hour: Update prices for all watchlisted companies
        {
          name: 'price-updates',
          schedule: '0 * * * *',
          task: this.priceUpdateTask.bind(this),
          enabled: true
        },

        // Every 30 minutes: Process pending alerts
        {
          name: 'alert-processing',
          schedule: '*/30 * * * *',
          task: this.alertProcessingTask.bind(this),
          enabled: true
        },

        // Daily at 2 AM: Data cleanup
        {
          name: 'data-cleanup',
          schedule: '0 2 * * *',
          task: this.dataCleanupTask.bind(this),
          enabled: true
        },

        // Every 5 minutes: Health checks
        {
          name: 'health-checks',
          schedule: '*/5 * * * *',
          task: this.healthCheckTask.bind(this),
          enabled: true
        },

        // Daily at 6 AM: Generate daily summaries
        {
          name: 'daily-summaries',
          schedule: '0 6 * * *',
          task: this.dailySummaryTask.bind(this),
          enabled: true
        },

        // Every 2 hours: Retry failed jobs
        {
          name: 'retry-failed-jobs',
          schedule: '0 */2 * * *',
          task: this.retryFailedJobsTask.bind(this),
          enabled: true
        }
      ]

      // Schedule all enabled jobs
      for (const jobConfig of cronJobs) {
        if (jobConfig.enabled) {
          this.scheduleJob(jobConfig)
        }
      }

      // Start the job queue processing
      await jobQueue.startProcessing()

      this.isInitialized = true
      console.log('Cron scheduler initialized successfully')

    } catch (error) {
      console.error('Failed to initialize cron scheduler:', error)
      throw error
    }
  }

  // Schedule a single cron job
  private scheduleJob(config: CronJobConfig) {
    try {
      const task = cron.schedule(
        config.schedule,
        async () => {
          console.log(`Running cron job: ${config.name}`)
          try {
            await config.task()
            console.log(`Cron job completed: ${config.name}`)
          } catch (error) {
            console.error(`Cron job failed: ${config.name}`, error)
          }
        },
        {
          scheduled: false,
          timezone: config.timezone || 'UTC'
        }
      )

      this.jobs.set(config.name, task)
      task.start()

      console.log(`Scheduled cron job: ${config.name} (${config.schedule})`)
    } catch (error) {
      console.error(`Failed to schedule cron job: ${config.name}`, error)
      throw error
    }
  }

  // Stop all cron jobs
  stop() {
    console.log('Stopping cron scheduler...')
    
    for (const [name, task] of this.jobs) {
      task.stop()
      console.log(`Stopped cron job: ${name}`)
    }
    
    jobQueue.stopProcessing()
    this.jobs.clear()
    this.isInitialized = false
    
    console.log('Cron scheduler stopped')
  }

  // Get status of all cron jobs
  getStatus() {
    const jobs = []
    for (const [name, task] of this.jobs) {
      jobs.push({
        name,
        running: task.getStatus() === 'scheduled'
      })
    }
    return jobs
  }

  // EDGAR polling task - check for new filings
  private async edgarPollingTask() {
    try {
      // Get all active companies that should be monitored
      const activeCompanies = await prisma.company.findMany({
        where: {
          isActive: true,
          // Only poll companies that have at least one user watching them
          watchlists: {
            some: {
              isActive: true
            }
          }
        },
        select: {
          cik: true,
          symbol: true,
          name: true
        },
        take: 50 // Limit to prevent rate limit issues
      })

      if (activeCompanies.length === 0) {
        console.log('No active companies to poll')
        return
      }

      console.log(`Polling EDGAR for ${activeCompanies.length} companies`)

      // Queue EDGAR polling job
      await JobHelpers.pollEdgar(
        activeCompanies.map(c => c.cik),
        1 // Check last 1 hour
      )

    } catch (error) {
      console.error('EDGAR polling task failed:', error)
      throw error
    }
  }

  // Price update task - update prices for watchlisted stocks
  private async priceUpdateTask() {
    try {
      // Get unique symbols from all active watchlists
      const watchlistSymbols = await prisma.watchlist.findMany({
        where: { isActive: true },
        select: {
          company: {
            select: { symbol: true }
          }
        },
        distinct: ['companyId']
      })

      const symbols = watchlistSymbols
        .map(w => w.company.symbol)
        .filter(symbol => symbol && symbol.length > 0)

      if (symbols.length === 0) {
        console.log('No symbols to update prices for')
        return
      }

      console.log(`Updating prices for ${symbols.length} symbols`)

      // Queue price update job
      await JobHelpers.updatePrices(symbols)

    } catch (error) {
      console.error('Price update task failed:', error)
      throw error
    }
  }

  // Alert processing task - handle pending alerts
  private async alertProcessingTask() {
    try {
      // Get pending alerts that need to be sent
      const pendingAlerts = await prisma.alert.findMany({
        where: {
          status: 'PENDING',
          scheduledFor: { lte: new Date() }
        },
        take: 100,
        orderBy: { createdAt: 'asc' }
      })

      if (pendingAlerts.length === 0) {
        console.log('No pending alerts to process')
        return
      }

      console.log(`Processing ${pendingAlerts.length} pending alerts`)

      // Queue alert dispatch jobs
      for (const alert of pendingAlerts) {
        await JobHelpers.dispatchAlert(alert, 'HIGH')
      }

    } catch (error) {
      console.error('Alert processing task failed:', error)
      throw error
    }
  }

  // Data cleanup task - remove old data
  private async dataCleanupTask() {
    try {
      console.log('Running daily data cleanup')

      // Queue data cleanup job
      await JobHelpers.cleanupData(90) // Keep 90 days of data

      // Additional cleanup tasks
      await this.cleanupOldJobs()
      await this.cleanupUnverifiedUsers()

    } catch (error) {
      console.error('Data cleanup task failed:', error)
      throw error
    }
  }

  // Health check task - monitor system health
  private async healthCheckTask() {
    try {
      // Check database connection
      const { checkDatabaseConnection, getDatabaseStats } = await import('@/lib/db')
      const dbHealth = await checkDatabaseConnection()
      
      if (!dbHealth.isConnected) {
        console.error('Database health check failed:', dbHealth.error)
        // Could send alert to admins here
      }

      // Check job queue status
      const queueStats = await jobQueue.getQueueStats()
      
      // Log warnings for concerning queue states
      if (queueStats.failed > 100) {
        console.warn(`High number of failed jobs: ${queueStats.failed}`)
      }
      
      if (queueStats.pending > 1000) {
        console.warn(`High number of pending jobs: ${queueStats.pending}`)
      }

      // Get database stats
      const dbStats = await getDatabaseStats()
      
      console.log('Health check completed:', {
        database: { connected: dbHealth.isConnected, latency: dbHealth.latency },
        queue: queueStats,
        stats: dbStats
      })

    } catch (error) {
      console.error('Health check task failed:', error)
      // Don't throw - health checks should not crash the scheduler
    }
  }

  // Daily summary task - generate daily reports
  private async dailySummaryTask() {
    try {
      console.log('Generating daily summaries')

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      
      // Get filing stats for yesterday
      const filingStats = await prisma.filing.findMany({
        where: {
          filedDate: {
            gte: yesterday,
            lt: new Date()
          }
        },
        include: {
          diffs: {
            where: { materialityScore: { gte: 0.7 } }
          }
        }
      })

      const totalFilings = filingStats.length
      const materialFilings = filingStats.filter(f => f.diffs.length > 0).length

      console.log(`Daily summary: ${totalFilings} filings, ${materialFilings} with material changes`)

      // Could send daily summary emails to users here
      // await this.sendDailySummaryEmails(filingStats)

    } catch (error) {
      console.error('Daily summary task failed:', error)
      throw error
    }
  }

  // Retry failed jobs task
  private async retryFailedJobsTask() {
    try {
      // Find failed jobs that could be retried
      const retryableJobs = await prisma.job.findMany({
        where: {
          status: 'FAILED',
          retryCount: { lt: 3 }, // Haven't exceeded max retries
          completedAt: {
            // Failed more than 1 hour ago
            lt: new Date(Date.now() - 60 * 60 * 1000)
          }
        },
        take: 10 // Limit retries
      })

      if (retryableJobs.length === 0) {
        return
      }

      console.log(`Retrying ${retryableJobs.length} failed jobs`)

      // Reset jobs to pending status
      for (const job of retryableJobs) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            scheduledFor: new Date(),
            errorMessage: null
          }
        })
      }

    } catch (error) {
      console.error('Retry failed jobs task failed:', error)
      throw error
    }
  }

  // Helper: Clean up old completed jobs
  private async cleanupOldJobs() {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    const deleted = await prisma.job.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        completedAt: { lt: cutoffDate }
      }
    })

    console.log(`Cleaned up ${deleted.count} old jobs`)
  }

  // Helper: Clean up unverified users after 30 days
  private async cleanupUnverifiedUsers() {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    const deleted = await prisma.user.deleteMany({
      where: {
        emailVerified: null,
        createdAt: { lt: cutoffDate }
      }
    })

    console.log(`Cleaned up ${deleted.count} unverified users`)
  }
}

// Global scheduler instance
export const cronScheduler = new CronScheduler()

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  cronScheduler.initialize().catch(error => {
    console.error('Failed to auto-initialize cron scheduler:', error)
  })
}

// Graceful shutdown
process.on('SIGTERM', () => {
  cronScheduler.stop()
})

process.on('SIGINT', () => {
  cronScheduler.stop()
})

export default cronScheduler