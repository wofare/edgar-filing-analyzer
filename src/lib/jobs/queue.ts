import { prisma } from '@/lib/db'
import { JobStatus, JobType, JobPriority } from '@prisma/client'

export interface QueueJob {
  id?: string
  type: JobType
  status?: JobStatus
  priority?: JobPriority
  parameters: Record<string, any>
  scheduledFor?: Date
  maxRetries?: number
  retryCount?: number
  errorMessage?: string
  result?: Record<string, any>
}

export interface QueueOptions {
  concurrency?: number
  maxRetries?: number
  retryDelay?: (attempt: number) => number
  onError?: (error: Error, job: QueueJob) => void
  onSuccess?: (result: any, job: QueueJob) => void
}

export class JobQueue {
  private isProcessing = false
  private processingJobs = new Set<string>()
  private options: Required<QueueOptions>

  constructor(options: QueueOptions = {}) {
    this.options = {
      concurrency: options.concurrency || 3,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || ((attempt) => Math.min(1000 * Math.pow(2, attempt), 30000)),
      onError: options.onError || (() => {}),
      onSuccess: options.onSuccess || (() => {})
    }
  }

  // Add a job to the queue
  async addJob(job: QueueJob): Promise<string> {
    try {
      const createdJob = await prisma.job.create({
        data: {
          type: job.type,
          status: job.status || 'PENDING',
          priority: job.priority || 'NORMAL',
          parameters: job.parameters,
          scheduledFor: job.scheduledFor || new Date(),
          maxRetries: job.maxRetries || this.options.maxRetries,
          retryCount: 0
        }
      })

      console.log(`Job added to queue: ${createdJob.id} (${createdJob.type})`)
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing()
      }

      return createdJob.id
    } catch (error) {
      console.error('Failed to add job to queue:', error)
      throw error
    }
  }

  // Add multiple jobs in batch
  async addJobs(jobs: QueueJob[]): Promise<string[]> {
    try {
      const createdJobs = await prisma.job.createMany({
        data: jobs.map(job => ({
          type: job.type,
          status: job.status || 'PENDING',
          priority: job.priority || 'NORMAL',
          parameters: job.parameters,
          scheduledFor: job.scheduledFor || new Date(),
          maxRetries: job.maxRetries || this.options.maxRetries,
          retryCount: 0
        }))
      })

      console.log(`${createdJobs.count} jobs added to queue`)

      if (!this.isProcessing) {
        this.startProcessing()
      }

      return []
    } catch (error) {
      console.error('Failed to add jobs to queue:', error)
      throw error
    }
  }

  // Start processing jobs from the queue
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true
    console.log('Job queue processing started')

    while (this.isProcessing) {
      try {
        // Check if we can process more jobs
        if (this.processingJobs.size >= this.options.concurrency) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }

        // Get next job to process
        const job = await this.getNextJob()
        if (!job) {
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5s if no jobs
          continue
        }

        // Process job in background
        this.processJob(job).catch(error => {
          console.error(`Job processing failed: ${job.id}`, error)
        })

      } catch (error) {
        console.error('Error in queue processing loop:', error)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  }

  // Stop processing jobs
  stopProcessing(): void {
    this.isProcessing = false
    console.log('Job queue processing stopped')
  }

  // Get the next job to process
  private async getNextJob() {
    return await prisma.job.findFirst({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: new Date() }
      },
      orderBy: [
        { priority: 'desc' }, // HIGH > NORMAL > LOW
        { createdAt: 'asc' }   // FIFO within same priority
      ]
    })
  }

  // Process a single job
  private async processJob(job: any): Promise<void> {
    const jobId = job.id
    this.processingJobs.add(jobId)

    try {
      // Mark job as running
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'RUNNING',
          startedAt: new Date()
        }
      })

      console.log(`Processing job: ${jobId} (${job.type})`)

      // Execute the job based on type
      const result = await this.executeJob(job)

      // Mark job as completed
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result
        }
      })

      console.log(`Job completed: ${jobId}`)
      this.options.onSuccess(result, job)

    } catch (error) {
      console.error(`Job failed: ${jobId}`, error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Check if we should retry
      if (job.retryCount < job.maxRetries) {
        const nextRetry = new Date(Date.now() + this.options.retryDelay(job.retryCount + 1))
        
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            retryCount: job.retryCount + 1,
            errorMessage,
            scheduledFor: nextRetry
          }
        })

        console.log(`Job scheduled for retry: ${jobId} (attempt ${job.retryCount + 1}/${job.maxRetries})`)
      } else {
        // Mark job as permanently failed
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage
          }
        })

        console.log(`Job permanently failed: ${jobId}`)
        this.options.onError(error as Error, job)
      }
    } finally {
      this.processingJobs.delete(jobId)
    }
  }

  // Execute a job based on its type
  private async executeJob(job: any): Promise<any> {
    switch (job.type) {
      case 'FILING_INGESTION':
        return await this.processFilingIngestion(job.parameters)
      
      case 'ALERT_DISPATCH':
        return await this.processAlertDispatch(job.parameters)
      
      case 'EDGAR_POLLING':
        return await this.processEdgarPolling(job.parameters)
      
      case 'DATA_CLEANUP':
        return await this.processDataCleanup(job.parameters)
      
      case 'PRICE_UPDATE':
        return await this.processPriceUpdate(job.parameters)
      
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
  }

  // Filing ingestion job processor
  private async processFilingIngestion(params: any): Promise<any> {
    const { createEDGARClient } = await import('@/lib/edgar-client')
    const { createDiffEngine } = await import('@/lib/diff-engine')
    const { createSummarizationService } = await import('@/lib/summarization')

    const { cik, accessionNo, formType } = params
    
    const edgarClient = createEDGARClient()
    const diffEngine = createDiffEngine()
    const summarizationService = createSummarizationService()

    // Fetch filing from EDGAR
    const filingData = await edgarClient.getFiling(cik, accessionNo)
    if (!filingData) {
      throw new Error('Filing not found in EDGAR')
    }

    // Find or create company
    let company = await prisma.company.findUnique({ where: { cik } })
    if (!company) {
      const companyInfo = await edgarClient.getCompanyInfo(cik)
      company = await prisma.company.create({
        data: {
          cik,
          symbol: companyInfo.ticker || '',
          name: companyInfo.name,
          sic: companyInfo.sic,
          industry: companyInfo.industry,
          isActive: true
        }
      })
    }

    // Generate summary
    const summary = await summarizationService.generateSummary(filingData.content, {
      formType,
      ticker: company.symbol,
      companyName: company.name
    })

    // Create filing record
    const filing = await prisma.filing.create({
      data: {
        cik,
        accessionNo,
        companyId: company.id,
        ticker: company.symbol,
        companyName: company.name,
        formType,
        filedDate: new Date(filingData.filedDate),
        reportDate: filingData.reportDate ? new Date(filingData.reportDate) : null,
        url: filingData.url,
        content: filingData.content,
        summary: summary.summary,
        keyHighlights: summary.keyHighlights,
        investorImplications: summary.investorImplications,
        isProcessed: true
      }
    })

    return { filingId: filing.id, summary: summary.summary }
  }

  // Alert dispatch job processor
  private async processAlertDispatch(params: any): Promise<any> {
    const { createAlertDispatcher } = await import('@/lib/alerts')
    const alertDispatcher = createAlertDispatcher()
    
    return await alertDispatcher.dispatchAlert(params.alert)
  }

  // EDGAR polling job processor
  private async processEdgarPolling(params: any): Promise<any> {
    const { createEDGARClient } = await import('@/lib/edgar-client')
    const edgarClient = createEDGARClient()
    
    const { companies, hours = 24 } = params
    const results = []

    for (const cik of companies) {
      try {
        const recentFilings = await edgarClient.getRecentFilings(cik, { hours })
        for (const filing of recentFilings) {
          // Queue filing ingestion
          await this.addJob({
            type: 'FILING_INGESTION',
            parameters: {
              cik: filing.cik,
              accessionNo: filing.accessionNo,
              formType: filing.formType
            },
            priority: 'NORMAL'
          })
        }
        results.push({ cik, filings: recentFilings.length })
      } catch (error) {
        results.push({ cik, error: error.message })
      }
    }

    return { polled: results }
  }

  // Data cleanup job processor
  private async processDataCleanup(params: any): Promise<any> {
    const { cleanupOldData } = await import('@/lib/db')
    const { daysToKeep = 90 } = params
    
    return await cleanupOldData(daysToKeep)
  }

  // Price update job processor
  private async processPriceUpdate(params: any): Promise<any> {
    const { createPriceAdapter } = await import('@/lib/price-adapter')
    const priceAdapter = createPriceAdapter()
    
    const { symbols } = params
    const results = []

    for (const symbol of symbols) {
      try {
        const priceData = await priceAdapter.getPriceData(symbol)
        results.push({ symbol, price: priceData.current })
      } catch (error) {
        results.push({ symbol, error: error.message })
      }
    }

    return { updated: results }
  }

  // Get queue statistics
  async getQueueStats() {
    const [pending, running, completed, failed] = await Promise.all([
      prisma.job.count({ where: { status: 'PENDING' } }),
      prisma.job.count({ where: { status: 'RUNNING' } }),
      prisma.job.count({ where: { status: 'COMPLETED' } }),
      prisma.job.count({ where: { status: 'FAILED' } })
    ])

    return {
      pending,
      running,
      completed,
      failed,
      processing: this.processingJobs.size
    }
  }
}

// Global job queue instance
export const jobQueue = new JobQueue({
  concurrency: 3,
  maxRetries: 3,
  onError: (error, job) => {
    console.error(`Job failed permanently: ${job.id}`, error)
  },
  onSuccess: (result, job) => {
    console.log(`Job completed successfully: ${job.id}`)
  }
})

// Helper functions for common job types
export const JobHelpers = {
  // Queue a filing ingestion job
  async ingestFiling(cik: string, accessionNo: string, formType: string, priority: JobPriority = 'NORMAL') {
    return await jobQueue.addJob({
      type: 'FILING_INGESTION',
      parameters: { cik, accessionNo, formType },
      priority
    })
  },

  // Queue an alert dispatch job
  async dispatchAlert(alert: any, priority: JobPriority = 'HIGH') {
    return await jobQueue.addJob({
      type: 'ALERT_DISPATCH',
      parameters: { alert },
      priority
    })
  },

  // Queue EDGAR polling for multiple companies
  async pollEdgar(companies: string[], hours = 24) {
    return await jobQueue.addJob({
      type: 'EDGAR_POLLING',
      parameters: { companies, hours },
      priority: 'NORMAL'
    })
  },

  // Queue data cleanup job
  async cleanupData(daysToKeep = 90) {
    return await jobQueue.addJob({
      type: 'DATA_CLEANUP',
      parameters: { daysToKeep },
      priority: 'LOW',
      scheduledFor: new Date(Date.now() + 60000) // Run in 1 minute
    })
  },

  // Queue price updates for watchlist
  async updatePrices(symbols: string[]) {
    return await jobQueue.addJob({
      type: 'PRICE_UPDATE',
      parameters: { symbols },
      priority: 'NORMAL'
    })
  }
}