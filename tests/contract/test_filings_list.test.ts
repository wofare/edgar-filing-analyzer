import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/filings - Contract Tests', () => {
  it('should return 200 with recent filings list', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings',
    })

    // This test will fail until the API route is implemented
    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      filings: expect.arrayContaining([
        expect.objectContaining({
          accessionNo: expect.any(String),
          cik: expect.any(String),
          companyName: expect.any(String),
          ticker: expect.any(String),
          formType: expect.any(String),
          filedDate: expect.any(String),
          reportDate: expect.any(String),
          description: expect.any(String),
          hasChanges: expect.any(Boolean),
          materialityScore: expect.any(Number)
        })
      ]),
      pagination: expect.objectContaining({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number)
      })
    })
  })

  it('should filter filings by form type', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings?formType=10-K',
      query: { formType: '10-K' },
    })

    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    data.filings.forEach((filing: any) => {
      expect(filing.formType).toBe('10-K')
    })
  })

  it('should filter filings by ticker', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings?ticker=AAPL',
      query: { ticker: 'AAPL' },
    })

    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    data.filings.forEach((filing: any) => {
      expect(filing.ticker).toBe('AAPL')
    })
  })

  it('should filter filings by date range', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings?startDate=2023-01-01&endDate=2023-12-31',
      query: { startDate: '2023-01-01', endDate: '2023-12-31' },
    })

    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    data.filings.forEach((filing: any) => {
      const filedDate = new Date(filing.filedDate)
      expect(filedDate.getFullYear()).toBe(2023)
    })
  })

  it('should support pagination', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings?page=2&limit=10',
      query: { page: '2', limit: '10' },
    })

    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data.pagination.page).toBe(2)
    expect(data.pagination.limit).toBe(10)
    expect(data.filings).toHaveLength(10)
  })

  it('should return 400 for invalid date format', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/filings?startDate=invalid-date',
      query: { startDate: 'invalid-date' },
    })

    const handler = await import('@/app/api/filings/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Invalid date format',
      code: 'INVALID_DATE_FORMAT'
    })
  })
})