import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createEDGARClient } from '@/lib/edgar-client'
import { createDiffEngine } from '@/lib/diff-engine'
import { createSummarizationService } from '@/lib/summarization'
import { createAlertDispatcher } from '@/lib/alerts'
import { CompanyModel } from '@/models/company'
import { FilingModel } from '@/models/filing'

const IngestRequestSchema = z.object({
  cik: z.string().min(1, 'CIK is required'),
  accessionNo: z.string().min(1, 'Accession number is required'),
  formType: z.string().min(1, 'Form type is required'),
  forceReprocess: z.boolean().optional().default(false),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  generateAlerts: z.boolean().optional().default(true)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cik, accessionNo, formType, forceReprocess, priority, generateAlerts } = IngestRequestSchema.parse(body)

    const normalizedCIK = CompanyModel.normalizeCIK(cik)
    const normalizedAccession = FilingModel.normalizeAccessionNumber(accessionNo)

    // Check if filing already exists and not forcing reprocessing
    if (!forceReprocess) {
      const existingFiling = await prisma.filing.findUnique({
        where: {
          cik_accessionNo: {
            cik: normalizedCIK,
            accessionNo: normalizedAccession
          }
        }
      })

      if (existingFiling) {
        return NextResponse.json({
          message: 'Filing already processed',
          filingId: existingFiling.id,
          status: 'already_processed'
        }, { status: 200 })
      }
    }

    // Check if job is already queued
    const existingJob = await prisma.job.findFirst({
      where: {
        type: 'FILING_INGESTION',
        parameters: {
          cik: normalizedCIK,
          accessionNo: normalizedAccession
        },
        status: { in: ['PENDING', 'RUNNING'] }
      }
    })

    if (existingJob && !forceReprocess) {
      return NextResponse.json({
        message: 'Filing ingestion already queued',
        jobId: existingJob.id,
        status: 'already_queued'
      }, { status: 202 })
    }

    // Create ingestion job
    const job = await prisma.job.create({
      data: {
        type: 'FILING_INGESTION',
        status: 'PENDING',
        priority: priority.toUpperCase() as any,
        parameters: {
          cik: normalizedCIK,
          accessionNo: normalizedAccession,
          formType,
          forceReprocess,
          generateAlerts
        },
        scheduledFor: new Date()
      }
    })

    // For high priority jobs, process immediately in the background
    if (priority === 'high') {
      processFilingInBackground(job.id, {
        cik: normalizedCIK,
        accessionNo: normalizedAccession,
        formType,
        forceReprocess,
        generateAlerts
      }).catch(error => {
        console.error('Background processing failed:', error)
      })

      return NextResponse.json({
        message: 'High priority filing queued for immediate processing',
        jobId: job.id,
        status: 'processing'
      }, { status: 202 })
    }

    return NextResponse.json({
      message: 'Filing queued for ingestion',
      jobId: job.id,
      status: 'queued',
      estimatedProcessingTime: getEstimatedProcessingTime(formType)
    }, { status: 202 })

  } catch (error) {
    console.error('Error in filing ingest API:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format', 
          code: 'VALIDATION_ERROR',
          details: error.errors 
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    if (jobId) {
      // Get specific job status
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
          filing: true
        }
      })

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found', code: 'JOB_NOT_FOUND' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        job: {
          id: job.id,
          status: job.status,
          type: job.type,
          priority: job.priority,
          parameters: job.parameters,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
          errorMessage: job.errorMessage,
          result: job.result,
          filing: job.filing ? {
            id: job.filing.id,
            ticker: job.filing.ticker,
            companyName: job.filing.companyName,
            formType: job.filing.formType,
            filedDate: job.filing.filedDate.toISOString()
          } : null
        }
      })
    }

    // List jobs with optional status filter
    const where = status ? { 
      type: 'FILING_INGESTION',
      status: status.toUpperCase() as any
    } : { 
      type: 'FILING_INGESTION'
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        filing: {
          select: {
            id: true,
            ticker: true,
            companyName: true,
            formType: true,
            filedDate: true
          }
        }
      }
    })

    const total = await prisma.job.count({ where })

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        priority: job.priority,
        parameters: job.parameters,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        errorMessage: job.errorMessage,
        filing: job.filing
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Error in job listing API:', error)

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

async function processFilingInBackground(
  jobId: string,
  params: {
    cik: string
    accessionNo: string
    formType: string
    forceReprocess: boolean
    generateAlerts: boolean
  }
) {
  try {
    // Update job status to RUNNING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    })

    const { cik, accessionNo, formType, forceReprocess, generateAlerts } = params
    
    // Initialize services
    const edgarClient = createEDGARClient()
    const diffEngine = createDiffEngine()
    const summarizationService = createSummarizationService()
    const alertDispatcher = createAlertDispatcher()

    // Fetch filing from EDGAR
    const filingData = await edgarClient.getFiling(cik, accessionNo)
    
    if (!filingData) {
      throw new Error('Filing not found in EDGAR database')
    }

    // Find or create company
    let company = await prisma.company.findUnique({
      where: { cik }
    })

    if (!company) {
      const companyInfo = await edgarClient.getCompanyInfo(cik)
      company = await prisma.company.create({
        data: {
          cik,
          symbol: companyInfo.ticker || '',
          name: companyInfo.name,
          sic: companyInfo.sic,
          industry: companyInfo.industry || null,
          website: companyInfo.website || null,
          isActive: true
        }
      })
    }

    // Check for existing filing
    let filing = await prisma.filing.findUnique({
      where: {
        cik_accessionNo: { cik, accessionNo }
      }
    })

    if (filing && !forceReprocess) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: { filingId: filing.id, message: 'Filing already existed' }
        }
      })
      return
    }

    // Generate summary and highlights
    const summary = await summarizationService.generateSummary(filingData.content, {
      formType,
      ticker: company.symbol,
      companyName: company.name
    })

    // Create or update filing
    const filingCreateData = {
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
      materialChanges: 0, // Will be updated by diff engine
      riskFactorChanges: 0,
      businessChanges: 0,
      isProcessed: false
    }

    if (filing && forceReprocess) {
      filing = await prisma.filing.update({
        where: { id: filing.id },
        data: filingCreateData
      })
    } else {
      filing = await prisma.filing.create({
        data: filingCreateData
      })
    }

    // Run diff analysis against previous filing
    const previousFiling = await prisma.filing.findFirst({
      where: {
        companyId: company.id,
        formType: formType === '10-K' ? '10-K' : { in: ['10-Q', '10-K'] },
        filedDate: { lt: filing.filedDate },
        id: { not: filing.id }
      },
      orderBy: { filedDate: 'desc' }
    })

    if (previousFiling) {
      const diffs = await diffEngine.compareFilings(previousFiling.content, filing.content, {
        formType,
        ticker: company.symbol
      })

      // Create diff records
      for (const diff of diffs) {
        await prisma.diff.create({
          data: {
            filingId: filing.id,
            previousFilingId: previousFiling.id,
            section: diff.section,
            changeType: diff.changeType.toUpperCase() as any,
            summary: diff.summary,
            impact: diff.impact,
            materialityScore: diff.materialityScore,
            beforeText: diff.beforeText?.substring(0, 10000), // Truncate for DB
            afterText: diff.afterText?.substring(0, 10000),
            lineNumber: diff.lineNumber
          }
        })
      }

      // Update filing with change counts
      const materialDiffs = diffs.filter(d => d.materialityScore >= 0.7)
      const riskDiffs = diffs.filter(d => d.section.toLowerCase().includes('risk'))
      const businessDiffs = diffs.filter(d => d.section.toLowerCase().includes('business'))

      await prisma.filing.update({
        where: { id: filing.id },
        data: {
          materialChanges: materialDiffs.length,
          riskFactorChanges: riskDiffs.length,
          businessChanges: businessDiffs.length,
          isProcessed: true
        }
      })

      // Generate alerts for material changes
      if (generateAlerts && materialDiffs.length > 0) {
        const watchlistUsers = await prisma.watchlist.findMany({
          where: { companyId: company.id },
          include: {
            user: {
              include: {
                alertSettings: true
              }
            }
          }
        })

        for (const watchlistItem of watchlistUsers) {
          const user = watchlistItem.user
          const alertSettings = user.alertSettings.find(
            setting => setting.alertType === 'MATERIAL_CHANGE' && setting.isEnabled
          )

          if (alertSettings) {
            const alert = {
              id: `material-${filing.id}-${user.id}`,
              userId: user.id,
              method: alertSettings.method,
              recipient: alertSettings.method === 'EMAIL' ? user.email : user.phone || '',
              title: `🚨 Material Change: ${company.symbol}`,
              message: `${company.name} has filed a ${formType} with ${materialDiffs.length} material changes.`,
              priority: 'high' as const,
              template: 'material_change',
              variables: {
                ticker: company.symbol,
                formType,
                companyName: company.name,
                summary: summary.summary,
                changes: materialDiffs.map(d => `<li>${d.summary}</li>`).join(''),
                changesText: materialDiffs.map(d => `• ${d.summary}`).join('\n'),
                impact: materialDiffs.map(d => d.impact).join(' '),
                viewUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/stocks/${company.symbol}`,
                shortUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/s/${company.symbol}`
              }
            }

            try {
              await alertDispatcher.dispatchAlert(alert)
            } catch (alertError) {
              console.error('Failed to send alert:', alertError)
            }
          }
        }
      }
    } else {
      // First filing for this company
      await prisma.filing.update({
        where: { id: filing.id },
        data: { isProcessed: true }
      })
    }

    // Complete job
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        filingId: filing.id,
        result: {
          filingId: filing.id,
          materialChanges: filing.materialChanges,
          alertsSent: generateAlerts
        }
      }
    })

  } catch (error) {
    console.error('Filing processing failed:', error)
    
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        result: { error: 'Processing failed' }
      }
    })
  }
}

function getEstimatedProcessingTime(formType: string): string {
  switch (formType) {
    case '10-K':
      return '5-10 minutes'
    case '10-Q':
      return '3-5 minutes'
    case '8-K':
      return '1-2 minutes'
    default:
      return '2-5 minutes'
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}