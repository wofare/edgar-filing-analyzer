import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/stocks/[ticker]/overview - Contract Tests', () => {
  it('should return 200 with valid overview data for existing ticker', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/stocks/AAPL/overview',
      query: { ticker: 'AAPL' },
    })

    // This test will fail until the API route is implemented
    const handler = await import('@/app/api/stocks/[ticker]/overview/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      ticker: expect.any(String),
      companyName: expect.any(String),
      latestFiling: expect.objectContaining({
        formType: expect.any(String),
        filedDate: expect.any(String),
        summary: expect.any(String),
        soWhat: expect.arrayContaining([expect.any(String)]),
        materialityScore: expect.any(Number),
      }),
      priceData: expect.objectContaining({
        current: expect.any(Number),
        change: expect.any(Number),
        changePercent: expect.any(Number),
        sparkline: expect.arrayContaining([expect.any(Number)]),
      }),
      recentFilings: expect.arrayContaining([
        expect.objectContaining({
          accessionNo: expect.any(String),
          formType: expect.any(String),
          filedDate: expect.any(String),
        })
      ]),
      materialChanges: expect.arrayContaining([
        expect.objectContaining({
          type: expect.any(String),
          description: expect.any(String),
          impact: expect.any(String),
        })
      ])
    })
  })

  it('should return 404 for non-existent ticker', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/stocks/INVALID/overview',
      query: { ticker: 'INVALID' },
    })

    const handler = await import('@/app/api/stocks/[ticker]/overview/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(404)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Ticker not found',
      code: 'TICKER_NOT_FOUND'
    })
  })

  it('should return 400 for invalid ticker format', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/stocks/123/overview',
      query: { ticker: '123' },
    })

    const handler = await import('@/app/api/stocks/[ticker]/overview/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Invalid ticker format',
      code: 'INVALID_TICKER'
    })
  })
})