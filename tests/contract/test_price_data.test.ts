import { describe, expect, it } from '@jest/globals'
import { createMocks } from 'node-mocks-http'

describe('/api/price/[symbol] - Contract Tests', () => {
  it('should return 200 with current price data for valid symbol', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/price/AAPL',
      query: { symbol: 'AAPL' },
    })

    // This test will fail until the API route is implemented
    const handler = await import('@/app/api/price/[symbol]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data).toMatchObject({
      symbol: expect.any(String),
      current: expect.any(Number),
      open: expect.any(Number),
      high: expect.any(Number),
      low: expect.any(Number),
      previousClose: expect.any(Number),
      change: expect.any(Number),
      changePercent: expect.any(Number),
      volume: expect.any(Number),
      marketCap: expect.any(Number),
      lastUpdated: expect.any(String),
      sparkline: expect.arrayContaining([expect.any(Number)]),
      provider: expect.any(String)
    })
  })

  it('should return price data with sparkline for specified period', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/price/AAPL?period=1M',
      query: { symbol: 'AAPL', period: '1M' },
    })

    const handler = await import('@/app/api/price/[symbol]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data.sparkline).toHaveLength(30) // 30 days for 1M period
    expect(data.period).toBe('1M')
  })

  it('should return 404 for invalid symbol', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/price/INVALID',
      query: { symbol: 'INVALID' },
    })

    const handler = await import('@/app/api/price/[symbol]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(404)
    expect(JSON.parse(res._getData())).toMatchObject({
      error: 'Symbol not found',
      code: 'SYMBOL_NOT_FOUND'
    })
  })

  it('should fallback to secondary provider on primary failure', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      url: '/api/price/AAPL?forceFailover=true',
      query: { symbol: 'AAPL', forceFailover: 'true' },
    })

    const handler = await import('@/app/api/price/[symbol]/route')
    await handler.GET(req as any)

    expect(res._getStatusCode()).toBe(200)
    
    const data = JSON.parse(res._getData())
    expect(data.provider).not.toBe('alpha') // Should use fallback provider
    expect(data.fallbackUsed).toBe(true)
  })
})