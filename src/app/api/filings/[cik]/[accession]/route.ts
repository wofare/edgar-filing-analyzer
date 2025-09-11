import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createDiffEngine } from '@/lib/diff-engine'
import { CompanyModel } from '@/models/company'
import { FilingModel } from '@/models/filing'

const FilingDiffQuerySchema = z.object({
  includeContent: z.boolean().optional().default(false),
  includeDiffs: z.boolean().optional().default(true),
  materialityThreshold: z.number().min(0).max(1).optional().default(0.5),
  sectionFilter: z.string().optional(),
  compareWith: z.string().optional(), // accession number to compare with
  diffFormat: z.enum(['summary', 'detailed', 'raw']).optional().default('summary')
})

interface FilingDiffResponse {
  filing: {
    id: string
    cik: string
    accessionNo: string
    ticker: string
    companyName: string
    formType: string
    filedDate: string
    reportDate: string | null
    url: string
    summary: string | null
    keyHighlights: string[] | null
    materialChanges: number
    riskFactorChanges: number
    businessChanges: number
    isProcessed: boolean
    content?: string
  }
  previousFiling?: {
    id: string
    accessionNo: string
    filedDate: string
    formType: string
  }
  diffs: Array<{
    id: string
    section: string
    changeType: string
    summary: string | null
    impact: string | null
    materialityScore: number
    lineNumber: number | null
    beforeText?: string
    afterText?: string
    context?: {
      beforeLines: string[]
      afterLines: string[]
    }
  }>
  metadata: {
    totalChanges: number
    materialChanges: number
    sectionsChanged: string[]
    analysisDate: string
    comparisonMethod: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { cik: string; accession: string } }
) {
  try {
    const { cik, accession } = params
    const { searchParams } = new URL(request.url)
    
    // Validate parameters
    if (!cik || !accession) {
      return NextResponse.json(
        { error: 'CIK and accession number are required', code: 'MISSING_PARAMETERS' },
        { status: 400 }
      )
    }

    const normalizedCIK = CompanyModel.normalizeCIK(cik)
    const normalizedAccession = FilingModel.normalizeAccessionNumber(accession)

    // Parse query parameters
    const queryParams = {
      includeContent: searchParams.get('includeContent') === 'true',
      includeDiffs: searchParams.get('includeDiffs') !== 'false', // default true
      materialityThreshold: parseFloat(searchParams.get('materialityThreshold') || '0.5'),
      sectionFilter: searchParams.get('sectionFilter') || undefined,
      compareWith: searchParams.get('compareWith') || undefined,
      diffFormat: searchParams.get('diffFormat') as 'summary' | 'detailed' | 'raw' || 'summary'
    }

    const validated = FilingDiffQuerySchema.parse(queryParams)
    const { 
      includeContent, 
      includeDiffs, 
      materialityThreshold, 
      sectionFilter,
      compareWith,
      diffFormat
    } = validated

    // Find the filing
    const filing = await prisma.filing.findUnique({
      where: {
        cik_accessionNo: {
          cik: normalizedCIK,
          accessionNo: normalizedAccession
        }
      }
    })

    if (!filing) {
      return NextResponse.json(
        { error: 'Filing not found', code: 'FILING_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Determine which filing to compare against
    let comparisonAccession = compareWith
    let previousFiling = null

    if (comparisonAccession) {
      // Use specific filing for comparison
      const normalizedComparisonAccession = FilingModel.normalizeAccessionNumber(comparisonAccession)
      previousFiling = await prisma.filing.findUnique({
        where: {
          cik_accessionNo: {
            cik: normalizedCIK,
            accessionNo: normalizedComparisonAccession
          }
        }
      })

      if (!previousFiling) {
        return NextResponse.json(
          { error: 'Comparison filing not found', code: 'COMPARISON_FILING_NOT_FOUND' },
          { status: 404 }
        )
      }
    } else {
      // Find the most recent previous filing of same or compatible type
      const compatibleFormTypes = getCompatibleFormTypes(filing.formType)
      
      previousFiling = await prisma.filing.findFirst({
        where: {
          cik: normalizedCIK,
          formType: { in: compatibleFormTypes },
          filedDate: { lt: filing.filedDate },
          id: { not: filing.id }
        },
        orderBy: { filedDate: 'desc' }
      })
    }

    // Build diff filter
    const diffWhere: any = {
      filingId: filing.id,
      materialityScore: { gte: materialityThreshold }
    }

    if (sectionFilter) {
      diffWhere.section = { contains: sectionFilter, mode: 'insensitive' }
    }

    if (previousFiling) {
      diffWhere.previousFilingId = previousFiling.id
    }

    // Get diffs
    let diffs: any[] = []
    if (includeDiffs) {
      diffs = await prisma.diff.findMany({
        where: diffWhere,
        orderBy: [
          { materialityScore: 'desc' },
          { lineNumber: 'asc' }
        ],
        select: {
          id: true,
          section: true,
          changeType: true,
          summary: true,
          impact: true,
          materialityScore: true,
          lineNumber: true,
          beforeText: diffFormat !== 'summary',
          afterText: diffFormat !== 'summary'
        }
      })

      // Add context for detailed format
      if (diffFormat === 'detailed' && filing.content && previousFiling) {
        const diffEngine = createDiffEngine()
        
        for (const diff of diffs) {
          if (diff.lineNumber && diff.beforeText && diff.afterText) {
            try {
              const context = await diffEngine.getChangeContext(
                previousFiling.content,
                filing.content,
                diff.lineNumber,
                3 // lines of context
              )
              
              diff.context = context
            } catch (error) {
              console.warn('Failed to get diff context:', error)
            }
          }
        }
      }
    }

    // Generate real-time diff if no stored diffs and we have a previous filing
    if (includeDiffs && diffs.length === 0 && previousFiling && previousFiling.content && filing.content) {
      try {
        const diffEngine = createDiffEngine()
        const realTimeDiffs = await diffEngine.compareFilings(previousFiling.content, filing.content, {
          formType: filing.formType,
          ticker: filing.ticker
        })

        diffs = realTimeDiffs
          .filter(d => d.materialityScore >= materialityThreshold)
          .filter(d => !sectionFilter || d.section.toLowerCase().includes(sectionFilter.toLowerCase()))
          .map(d => ({
            id: `realtime-${d.section}-${d.lineNumber}`,
            section: d.section,
            changeType: d.changeType,
            summary: d.summary,
            impact: d.impact,
            materialityScore: d.materialityScore,
            lineNumber: d.lineNumber,
            beforeText: diffFormat !== 'summary' ? d.beforeText : undefined,
            afterText: diffFormat !== 'summary' ? d.afterText : undefined
          }))
      } catch (error) {
        console.warn('Failed to generate real-time diff:', error)
      }
    }

    // Format response
    const response: FilingDiffResponse = {
      filing: {
        id: filing.id,
        cik: filing.cik,
        accessionNo: filing.accessionNo,
        ticker: filing.ticker,
        companyName: filing.companyName,
        formType: filing.formType,
        filedDate: filing.filedDate.toISOString(),
        reportDate: filing.reportDate?.toISOString() || null,
        url: filing.url,
        summary: filing.summary,
        keyHighlights: filing.keyHighlights,
        materialChanges: filing.materialChanges,
        riskFactorChanges: filing.riskFactorChanges,
        businessChanges: filing.businessChanges,
        isProcessed: filing.isProcessed,
        ...(includeContent && { content: filing.content })
      },
      ...(previousFiling && {
        previousFiling: {
          id: previousFiling.id,
          accessionNo: previousFiling.accessionNo,
          filedDate: previousFiling.filedDate.toISOString(),
          formType: previousFiling.formType
        }
      }),
      diffs,
      metadata: {
        totalChanges: diffs.length,
        materialChanges: diffs.filter(d => d.materialityScore >= 0.7).length,
        sectionsChanged: [...new Set(diffs.map(d => d.section))],
        analysisDate: new Date().toISOString(),
        comparisonMethod: previousFiling ? 'historical' : 'none'
      }
    }

    // Add performance headers
    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'x-filing-id': filing.id,
      'x-total-diffs': diffs.length.toString(),
      'x-material-diffs': diffs.filter(d => d.materialityScore >= 0.7).length.toString(),
      'x-has-comparison': (!!previousFiling).toString()
    })

    return NextResponse.json(response, { headers: responseHeaders })

  } catch (error) {
    console.error('Error in filing diff API:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters', 
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

function getCompatibleFormTypes(formType: string): string[] {
  switch (formType) {
    case '10-K':
      return ['10-K']
    case '10-Q':
      return ['10-Q', '10-K'] // Compare 10-Q with previous 10-Q or 10-K
    case '8-K':
      return ['8-K']
    default:
      return [formType]
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}