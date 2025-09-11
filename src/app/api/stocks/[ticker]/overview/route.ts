import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createPriceAdapter } from '@/lib/price-adapter'
import { CompanyModel, CompanyNotFoundError, InvalidTickerError } from '@/models/company'

interface StockOverviewResponse {
  ticker: string
  companyName: string
  latestFiling: {
    formType: string
    filedDate: string
    summary: string
    soWhat: string[]
    materialityScore: number
  } | null
  priceData: {
    current: number
    change: number
    changePercent: number
    sparkline: number[]
  } | null
  recentFilings: Array<{
    accessionNo: string
    formType: string
    filedDate: string
  }>
  materialChanges: Array<{
    type: string
    description: string
    impact: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { ticker } = params

    // Validate ticker format
    if (!CompanyModel.validateTicker(ticker)) {
      return NextResponse.json(
        { error: 'Invalid ticker format', code: 'INVALID_TICKER' },
        { status: 400 }
      )
    }

    const normalizedTicker = CompanyModel.normalizeTicker(ticker)

    // Find company by ticker
    const company = await prisma.company.findUnique({
      where: { symbol: normalizedTicker },
      include: {
        filings: {
          orderBy: { filedDate: 'desc' },
          take: 10,
          include: {
            diffs: {
              where: { materialityScore: { gte: 0.7 } },
              orderBy: { materialityScore: 'desc' },
              take: 5
            }
          }
        }
      }
    })

    if (!company) {
      return NextResponse.json(
        { error: 'Ticker not found', code: 'TICKER_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Get latest filing with summary
    const latestFiling = company.filings[0]
    let latestFilingData = null

    if (latestFiling) {
      latestFilingData = {
        formType: latestFiling.formType,
        filedDate: latestFiling.filedDate.toISOString(),
        summary: latestFiling.summary || 'No summary available',
        soWhat: latestFiling.keyHighlights || [],
        materialityScore: latestFiling.materialChanges > 0 
          ? Math.min(1.0, latestFiling.materialChanges / 10) // Rough estimate
          : 0
      }
    }

    // Get price data
    let priceData = null
    try {
      const priceAdapter = createPriceAdapter()
      const price = await priceAdapter.getPriceData(normalizedTicker)
      
      priceData = {
        current: price.current,
        change: price.change,
        changePercent: price.changePercent,
        sparkline: price.sparkline
      }
    } catch (error) {
      // Price data is optional - continue without it
      console.warn(`Failed to fetch price data for ${normalizedTicker}:`, error)
    }

    // Format recent filings
    const recentFilings = company.filings.slice(0, 5).map(filing => ({
      accessionNo: filing.accessionNo,
      formType: filing.formType,
      filedDate: filing.filedDate.toISOString()
    }))

    // Extract material changes from latest filing
    const materialChanges = latestFiling?.diffs.map(diff => ({
      type: diff.changeType,
      description: diff.summary || 'Material change detected',
      impact: diff.impact || 'Impact assessment not available'
    })) || []

    const response: StockOverviewResponse = {
      ticker: normalizedTicker,
      companyName: company.name,
      latestFiling: latestFilingData,
      priceData,
      recentFilings,
      materialChanges
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in stocks overview API:', error)

    if (error instanceof InvalidTickerError) {
      return NextResponse.json(
        { error: 'Invalid ticker format', code: 'INVALID_TICKER' },
        { status: 400 }
      )
    }

    if (error instanceof CompanyNotFoundError) {
      return NextResponse.json(
        { error: 'Ticker not found', code: 'TICKER_NOT_FOUND' },
        { status: 404 }
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