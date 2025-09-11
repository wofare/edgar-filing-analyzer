import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { CompanyModel } from '@/models/company'

const FilingsQuerySchema = z.object({
  ticker: z.string().optional(),
  cik: z.string().optional(),
  formType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  materialChangesOnly: z.boolean().optional().default(false),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['filedDate', 'materialChanges', 'companyName']).optional().default('filedDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  includeContent: z.boolean().optional().default(false),
  includeDiffs: z.boolean().optional().default(false)
})

interface FilingsResponse {
  filings: Array<{
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
    diffs?: Array<{
      id: string
      section: string
      changeType: string
      summary: string | null
      impact: string | null
      materialityScore: number
    }>
  }>
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
  filters: {
    ticker?: string
    cik?: string
    formType?: string
    dateFrom?: string
    dateTo?: string
    materialChangesOnly: boolean
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse and validate query parameters
    const queryParams = {
      ticker: searchParams.get('ticker') || undefined,
      cik: searchParams.get('cik') || undefined,
      formType: searchParams.get('formType') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      materialChangesOnly: searchParams.get('materialChangesOnly') === 'true',
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') as 'filedDate' | 'materialChanges' | 'companyName' || 'filedDate',
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
      includeContent: searchParams.get('includeContent') === 'true',
      includeDiffs: searchParams.get('includeDiffs') === 'true'
    }

    const validated = FilingsQuerySchema.parse(queryParams)
    const { 
      ticker, 
      cik, 
      formType, 
      dateFrom, 
      dateTo, 
      materialChangesOnly, 
      limit, 
      offset, 
      sortBy, 
      sortOrder,
      includeContent,
      includeDiffs
    } = validated

    // Build where clause
    const where: any = {}

    if (ticker) {
      const normalizedTicker = CompanyModel.normalizeTicker(ticker)
      where.ticker = normalizedTicker
    }

    if (cik) {
      const normalizedCIK = CompanyModel.normalizeCIK(cik)
      where.cik = normalizedCIK
    }

    if (formType) {
      where.formType = formType.toUpperCase()
    }

    if (dateFrom || dateTo) {
      where.filedDate = {}
      if (dateFrom) {
        where.filedDate.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.filedDate.lte = new Date(dateTo)
      }
    }

    if (materialChangesOnly) {
      where.materialChanges = { gt: 0 }
    }

    // Build orderBy clause
    let orderBy: any
    switch (sortBy) {
      case 'materialChanges':
        orderBy = { materialChanges: sortOrder }
        break
      case 'companyName':
        orderBy = { companyName: sortOrder }
        break
      default:
        orderBy = { filedDate: sortOrder }
    }

    // Build include clause
    const include: any = {}
    if (includeDiffs) {
      include.diffs = {
        where: { materialityScore: { gte: 0.5 } },
        orderBy: { materialityScore: 'desc' },
        take: 10,
        select: {
          id: true,
          section: true,
          changeType: true,
          summary: true,
          impact: true,
          materialityScore: true
        }
      }
    }

    // Get filings
    const filings = await prisma.filing.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      include,
      select: {
        id: true,
        cik: true,
        accessionNo: true,
        ticker: true,
        companyName: true,
        formType: true,
        filedDate: true,
        reportDate: true,
        url: true,
        summary: true,
        keyHighlights: true,
        materialChanges: true,
        riskFactorChanges: true,
        businessChanges: true,
        isProcessed: true,
        content: includeContent,
        diffs: includeDiffs
      }
    })

    // Get total count for pagination
    const total = await prisma.filing.count({ where })

    // Format response
    const response: FilingsResponse = {
      filings: filings.map(filing => ({
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
        ...(includeContent && { content: filing.content }),
        ...(includeDiffs && { diffs: filing.diffs })
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: {
        ...(ticker && { ticker }),
        ...(cik && { cik }),
        ...(formType && { formType }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        materialChangesOnly
      }
    }

    // Add performance headers
    const responseHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'x-total-count': total.toString(),
      'x-page-size': limit.toString(),
      'x-page-offset': offset.toString(),
      'x-has-more': (offset + limit < total).toString()
    })

    return NextResponse.json(response, { headers: responseHeaders })

  } catch (error) {
    console.error('Error in filings list API:', error)

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

    if (error instanceof Error && error.message.includes('Invalid date')) {
      return NextResponse.json(
        { error: 'Invalid date format', code: 'INVALID_DATE_FORMAT' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
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